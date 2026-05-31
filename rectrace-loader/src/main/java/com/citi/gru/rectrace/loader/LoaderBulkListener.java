package com.citi.gru.rectrace.loader;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import co.elastic.clients.elasticsearch._helpers.bulk.BulkListener;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import lombok.extern.slf4j.Slf4j;

/**
 * Phase 6 / LOADER-10 — observer for a per-job {@code BulkIngester}.
 *
 * <p>The Elasticsearch Java API's {@link BulkListener} interface fires on three events:
 * <ol>
 *   <li>{@link #beforeBulk} — a batch is about to be flushed.</li>
 *   <li>{@link #afterBulk(long, BulkRequest, List, BulkResponse)} — a batch completed; the
 *       response may contain per-item errors which we count and log individually.</li>
 *   <li>{@link #afterBulk(long, BulkRequest, List, Throwable)} — the batch failed wholesale
 *       (transport error, ES unreachable, etc).</li>
 * </ol>
 *
 * <p>The generic context type is {@link String} ({@code "jobKey:docId"}) so per-item failure
 * logs identify the exact source row. {@code OracleToEsLoaderJob} reads
 * {@link #getFailedItemCount()} after {@code ingester.flush()} to decide SUCCESS vs FAILED
 * for the run-history record.
 *
 * <p>Not a Spring bean — instantiated directly by {@code LoaderJobRegistry.init()}, one
 * listener per job key.
 */
@Slf4j
public class LoaderBulkListener implements BulkListener<String> {

    private final String jobKey;
    private final AtomicLong failedItemCount = new AtomicLong(0);

    public LoaderBulkListener(String jobKey) {
        this.jobKey = jobKey;
    }

    /**
     * @return cumulative number of per-item failures observed since the listener was created
     *         (or since {@link #resetFailedItemCount()}). Read by {@code OracleToEsLoaderJob}
     *         after flush to classify the run.
     */
    public long getFailedItemCount() {
        return failedItemCount.get();
    }

    /**
     * Reset the per-run failure counter to zero. Called by {@code OracleToEsLoaderJob} before
     * each new run so cross-run state does not leak.
     */
    public void resetFailedItemCount() {
        failedItemCount.set(0);
    }

    @Override
    public void beforeBulk(long executionId, BulkRequest request, List<String> contexts) {
        log.debug("Loader [{}] bulk request #{} about to flush ({} ops)",
                jobKey, executionId, contexts.size());
    }

    @Override
    public void afterBulk(long executionId, BulkRequest request, List<String> contexts,
            BulkResponse response) {
        List<BulkResponseItem> items = response.items();
        int errorsInBatch = 0;
        for (int i = 0; i < items.size(); i++) {
            BulkResponseItem item = items.get(i);
            if (item.error() != null) {
                errorsInBatch++;
                String ctx = i < contexts.size() ? contexts.get(i) : "<unknown>";
                log.error("Loader [{}] bulk item failed: context={} reason={} type={}",
                        jobKey, ctx, item.error().reason(), item.error().type());
            }
        }
        if (errorsInBatch > 0) {
            failedItemCount.addAndGet(errorsInBatch);
            log.warn("Loader [{}] bulk request #{} completed with {} failed item(s) ({} total)",
                    jobKey, executionId, errorsInBatch, contexts.size());
        } else {
            log.debug("Loader [{}] bulk request #{} succeeded ({} ops)",
                    jobKey, executionId, contexts.size());
        }
    }

    @Override
    public void afterBulk(long executionId, BulkRequest request, List<String> contexts,
            Throwable failure) {
        failedItemCount.addAndGet(contexts.size());
        log.error("Loader [{}] bulk request #{} failed wholesale ({} ops in flight): {}",
                jobKey, executionId, contexts.size(), failure.toString(), failure);
    }
}

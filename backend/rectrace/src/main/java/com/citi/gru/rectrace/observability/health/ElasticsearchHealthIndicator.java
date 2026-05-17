package com.citi.gru.rectrace.observability.health;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.endpoints.BooleanResponse;

/**
 * Phase 7 / OBS-02 — health probe that calls {@link ElasticsearchClient#ping()} and reports
 * UP when the cluster responds true, DOWN on a false response or any thrown exception.
 *
 * <p>Bean name {@code "elasticsearch"} surfaces as {@code $.components.elasticsearch} in the
 * actuator JSON envelope. Extends {@link AbstractHealthIndicator} so IOException from the
 * transport is lifted to DOWN with the exception class+message in the {@code error} detail
 * (Pitfall P-4).
 *
 * <p>{@link Autowired}{@code (required=false)} matches the V4 search service convention
 * ({@code ElasticsearchServiceV4} also takes the client optionally) — the test profile boots
 * without a real client and the indicator reports DOWN ("client not configured").
 */
@Component("elasticsearch")
public class ElasticsearchHealthIndicator extends AbstractHealthIndicator {

    private final ElasticsearchClient client;

    @Autowired(required = false)
    public ElasticsearchHealthIndicator(@Nullable ElasticsearchClient client) {
        this.client = client;
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) throws Exception {
        if (client == null) {
            builder.down().withDetail("reason", "ElasticsearchClient not configured");
            return;
        }
        BooleanResponse resp = client.ping();
        if (resp != null && resp.value()) {
            builder.up();
        } else {
            builder.down().withDetail("reason", "ping returned false");
        }
    }
}

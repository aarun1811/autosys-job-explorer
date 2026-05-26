package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link OracleToEsLoaderJob#addSuggestFields(Map)} — the pure
 * enrichment that feeds the ES completion suggesters used by typeahead. The
 * full Oracle→ES loader run is not exercised here (requires Oracle); this pins
 * the field-derivation contract that gives loader-written docs prod-parity with
 * the local seed.
 */
class OracleToEsLoaderJobTest {

    @Test
    void derivesSuggestFieldsFromPresentStringSources() {
        Map<String, Object> row = new HashMap<>();
        row.put("recon", "SAMPLE_TRADE_RECON");
        row.put("box_name", "153106_TLM_BOX");
        row.put("job_name", "SBN_JOB_NAME");
        row.put("machine", "host01");
        row.put("run_calendar", "us_holiday");
        row.put("exclude_calendar", "HMC");
        row.put("sub_acc", "EUREX");
        row.put("set_id", "SET_42");

        OracleToEsLoaderJob.addSuggestFields(row);

        assertThat(row.get("recon_suggest")).isEqualTo("SAMPLE_TRADE_RECON");
        assertThat(row.get("box_name_suggest")).isEqualTo("153106_TLM_BOX");
        assertThat(row.get("job_name_suggest")).isEqualTo("SBN_JOB_NAME");
        assertThat(row.get("machine_suggest")).isEqualTo("host01");
        assertThat(row.get("run_calendar_suggest")).isEqualTo("us_holiday");
        assertThat(row.get("exclude_calendar_suggest")).isEqualTo("HMC");
        assertThat(row.get("sub_acc_suggest")).isEqualTo("EUREX");
        assertThat(row.get("set_id_suggest")).isEqualTo("SET_42");
    }

    @Test
    void skipsBlankMissingAndNonStringSources() {
        Map<String, Object> row = new HashMap<>();
        row.put("recon", "   ");      // blank → skipped (completion rejects empty input)
        row.put("box_name", "");       // empty → skipped
        row.put("set_id", 42);          // non-String → skipped
        // job_name absent entirely → skipped

        OracleToEsLoaderJob.addSuggestFields(row);

        assertThat(row).doesNotContainKeys(
                "recon_suggest", "box_name_suggest", "set_id_suggest", "job_name_suggest");
    }

    @Test
    void returnsTheSameMapInstanceAndLeavesUnrelatedColumnsUntouched() {
        Map<String, Object> row = new HashMap<>();
        row.put("job_name", "J1");
        row.put("app_id", "APP-9");

        Map<String, Object> result = OracleToEsLoaderJob.addSuggestFields(row);

        assertThat(result).isSameAs(row);
        assertThat(result.get("app_id")).isEqualTo("APP-9");
        assertThat(result.get("job_name_suggest")).isEqualTo("J1");
    }
}

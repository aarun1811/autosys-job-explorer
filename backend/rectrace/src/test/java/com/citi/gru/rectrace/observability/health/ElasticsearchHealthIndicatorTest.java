package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.endpoints.BooleanResponse;

/**
 * OBS-02 contract — {@link ElasticsearchHealthIndicator} pings the ES client and
 * reports UP on a true response, DOWN on a false response or IOException.
 */
class ElasticsearchHealthIndicatorTest {

    @Test
    void upWhenPingReturnsTrue() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        when(client.ping()).thenReturn(new BooleanResponse(true));

        ElasticsearchHealthIndicator indicator = new ElasticsearchHealthIndicator(client);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }

    @Test
    void downWhenPingReturnsFalse() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        when(client.ping()).thenReturn(new BooleanResponse(false));

        ElasticsearchHealthIndicator indicator = new ElasticsearchHealthIndicator(client);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("reason", "ping returned false");
    }

    @Test
    void downWhenPingThrowsIoException() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        when(client.ping()).thenThrow(new IOException("es unreachable"));

        ElasticsearchHealthIndicator indicator = new ElasticsearchHealthIndicator(client);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsKey("error");
        assertThat(health.getDetails().get("error").toString()).contains("es unreachable");
    }

    @Test
    void downWhenClientMissing() {
        ElasticsearchHealthIndicator indicator = new ElasticsearchHealthIndicator(null);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("reason",
                "ElasticsearchClient not configured");
    }
}

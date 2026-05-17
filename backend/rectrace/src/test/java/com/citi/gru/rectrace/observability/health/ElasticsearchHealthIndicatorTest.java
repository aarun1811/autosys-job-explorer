package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.endpoints.BooleanResponse;

/**
 * OBS-02 contract — {@code ElasticsearchHealthIndicator} pings the ES client and
 * reports UP on a true response, DOWN on a false response or IOException. Plan
 * 07-03 implements the indicator and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
class ElasticsearchHealthIndicatorTest {

    @Test
    void upWhenPingReturnsTrue() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        when(client.ping()).thenReturn(new BooleanResponse(true));

        HealthIndicator indicator = new ElasticsearchHealthIndicator(client);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }

    @Test
    void downWhenPingThrowsIoException() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        when(client.ping()).thenThrow(new IOException("es unreachable"));

        HealthIndicator indicator = new ElasticsearchHealthIndicator(client);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsKey("error");
    }

    /**
     * Forward declaration so this test compiles before Plan 07-03 lands the real
     * implementation. Plan 07-03 deletes this inner stub and adds the import
     * {@code com.citi.gru.rectrace.observability.health.ElasticsearchHealthIndicator}.
     */
    static class ElasticsearchHealthIndicator implements HealthIndicator {
        private final ElasticsearchClient client;

        ElasticsearchHealthIndicator(ElasticsearchClient client) {
            this.client = client;
        }

        @Override
        public Health health() {
            try {
                BooleanResponse resp = client.ping();
                return resp != null && resp.value() ? Health.up().build()
                        : Health.down().withDetail("error", "ping returned false").build();
            } catch (Exception e) {
                return Health.down()
                        .withDetail("error", e.getClass().getSimpleName() + ": " + e.getMessage())
                        .build();
            }
        }
    }
}

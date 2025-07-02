package com.citi.gru.rectrace.config;

import javax.net.ssl.SSLContext;

import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.conn.ssl.TrustStrategy;
import org.apache.http.impl.nio.client.HttpAsyncClientBuilder;
import org.apache.http.ssl.SSLContexts;
import org.elasticsearch.client.RestClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.elasticsearch.RestClientBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ElasticsearchDevConfiguration {

    private static final Logger logger = LoggerFactory.getLogger(ElasticsearchDevConfiguration.class);

    @Bean
    public RestClientBuilderCustomizer restClientBuilderCustomizer() {
        logger.warn("!!! WARNING: Configuring Elasticsearch REST client to bypass SSL validation for 'dev' profile !!!");
        logger.warn("!!! DO NOT USE THIS CONFIGURATION IN PRODUCTION ENVIRONMENTS !!!");

        return new RestClientBuilderCustomizer() {
            @Override
            public void customize(RestClientBuilder builder) {
                // Not needed for HttpAsyncClientBuilder customization
            }

            @Override
            public void customize(HttpAsyncClientBuilder httpAsyncClientBuilder) {
                try {
                    // Create a trust strategy that accepts all certificates
                    TrustStrategy acceptingTrustStrategy = (cert, authType) -> true;
                    SSLContext sslContext = SSLContexts.custom()
                            .loadTrustMaterial(null, acceptingTrustStrategy)
                            .build();

                    // Configure the client builder to use the permissive SSL context and Noop hostname verifier
                    httpAsyncClientBuilder.setSSLContext(sslContext);
                    httpAsyncClientBuilder.setSSLHostnameVerifier(NoopHostnameVerifier.INSTANCE);

                    logger.warn("!!! Elasticsearch SSL Validation Bypassed !!!");

                } catch (Exception e) {
                    logger.error("!!! Failed to customize Elasticsearch REST client to bypass SSL validation !!!", e);
                    // Throwing runtime exception might be better to prevent app start with misconfiguration
                    throw new RuntimeException("Failed to configure permissive SSL context for Elasticsearch", e);
                }
            }
        };
    }
}
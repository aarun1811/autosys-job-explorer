package com.citi.gru.rectrace;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ContextLoadsTest {

    @Test
    void contextLoads() {
        // Asserts that the Spring application context loads without errors
        // when Oracle and Elasticsearch are excluded via the "test" profile.
    }

}

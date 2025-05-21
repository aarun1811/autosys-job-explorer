package com.citi.gru.autosysjobexplorer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class AutosysJobExplorerApplication {

	public static void main(String[] args) {
		SpringApplication.run(AutosysJobExplorerApplication.class, args);
	}

}

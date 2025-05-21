package com.citi.gru.autosysjobexplorer.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.citi.gru.autosysjobexplorer.dto.ExecutionOrderDTO;
import com.citi.gru.autosysjobexplorer.service.ExecutionOrderService;

@RestController
@RequestMapping("/api/execution-order")
public class ExecutionOrderController {
    
    private final ExecutionOrderService executionOrderService;

    public ExecutionOrderController(ExecutionOrderService executionOrderService) {
        this.executionOrderService = executionOrderService;
    }

    @GetMapping("/{loadJobName}")
    public ExecutionOrderDTO getExecutionOrder(@PathVariable String loadJobName) {
        return executionOrderService.getExecutionOrder(loadJobName);
    }
} 
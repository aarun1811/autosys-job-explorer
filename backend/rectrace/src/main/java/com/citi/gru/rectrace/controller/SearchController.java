package com.citi.gru.rectrace.controller;

import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import com.citi.gru.rectrace.service.SuggestionService;

@Profile("!test")
@RestController
@RequestMapping("/api")
public class SearchController {

    private final SuggestionService suggestionService;

    public SearchController(SuggestionService suggestionService) {
        this.suggestionService = suggestionService;
    }

    @GetMapping("/search/suggest")
    public List<String> suggest(@RequestParam(name = "prefix") String prefix) {
        return suggestionService.getCombinedSuggestions(prefix);
    }
}

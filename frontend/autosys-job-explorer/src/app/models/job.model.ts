// Interface for the raw data rows returned for any search category
export interface JobData {
  [key: string]: any; // Allows for dynamic properties based on query results
}

// --- New Interfaces matching Backend DTOs ---

// Represents the definition of a single column for AG-Grid
export interface SearchColumnDefinition {
  field?: string;
  headerName?: string;
  sortable?: boolean;
  filter?: boolean;
  rowGroup?: boolean;
  hide?: boolean;
  cellRenderer?: string; // Name of the Angular component renderer
  cellRendererParams?: { [key: string]: any }; // Parameters for the cell renderer
  width?: number;
  minWidth?: number;
  pinned?: 'left' | 'right' | null;
  cellStyle?: { [key: string]: string }; // Styles for the cell
}

// Represents the configuration part for a single search category
export interface SearchCategoryConfig {
  key: string;
  label: string;
  columns: SearchColumnDefinition[];
  executionOrderColumn?: string;
}

// Represents the combined config and data for one search category result
export interface SearchCategoryResult {
  config: SearchCategoryConfig;
  data: JobData[];
}

// Represents the entire response structure from the backend /api/search endpoint
export interface SearchResponse {
  [categoryKey: string]: SearchCategoryResult;
}

// --- Interface for managing Tabs in the SearchComponent ---

export interface TabData {
  key: string;              // e.g., "jobName", "reconName"
  label: string;            // e.g., "Job Name", "Recon Name"
  data: JobData[];          // The actual search result rows for this tab
  columnDef: SearchColumnDefinition[]; // The AG-Grid column definitions for this tab (now from backend)
}
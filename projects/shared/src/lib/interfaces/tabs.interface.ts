export interface NavTab {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
  routeUrl?: string;  
}
export interface NavItem {
    displayName?: string;
    icon?: string;
    navCap?: string;
    route?: string;
    twoLines?: boolean;
    hidden?: boolean;
    roles?: string[];
    permissions? : string[];
}

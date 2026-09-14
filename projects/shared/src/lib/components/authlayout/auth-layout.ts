// auth-layout.component.ts
import { Component, Input } from '@angular/core'; 
import { RouterLink } from "@angular/router";

@Component({
    selector: 'app-auth-layout',
    standalone: true, 
    templateUrl: './auth-layout.html',
    styleUrl : './auth-layout.scss',
    imports: [RouterLink]
})
export class AuthLayoutComponent {
    @Input() cardtitle: string = 'Welcome';
    @Input() subtitle: string = ''; 

    currentYear = new Date().getFullYear();
}
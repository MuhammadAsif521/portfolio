import { Injectable, inject } from '@angular/core';
import {
    HttpClient,
    HttpContext,
    HttpHeaders,
    HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@shared/config/api.tokens';
import {
    ApiResponse,
    WITH_CREDENTIALS,
} from '@shared/interfaces/auth.interface';

export interface ApiRequestOptions {
    recaptchaToken?: string | null;
    recaptchaAction?: string | null; 
    credentials?: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class ApiService {
    private readonly http = inject(HttpClient);
    // Public API URL in the browser, internal Docker URL during SSR (see API_BASE_URL).
    private readonly baseUrl = inject(API_BASE_URL);

    get<T>(
        endpoint: string,
        params?: Record<string, any>,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const { cleanValue, requestOptions } = this.extractRequestOptions(
            params,
            options,
        );

        return this.http.get<ApiResponse<T>>(this.buildUrl(endpoint), {
            ...this.buildHttpOptions(requestOptions),
            params: this.buildParams(cleanValue),
        });
    }

    post<T>(
        endpoint: string,
        body?: any,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const { cleanValue, requestOptions } = this.extractRequestOptions(
            body,
            options,
        );

        return this.http.post<ApiResponse<T>>(
            this.buildUrl(endpoint),
            cleanValue,
            this.buildHttpOptions(requestOptions),
        );
    }

    postFormData<T>(
        endpoint: string,
        formData: FormData,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const requestOptions = this.extractFormDataRequestOptions(
            formData,
            options,
        );

        return this.http.post<ApiResponse<T>>(
            this.buildUrl(endpoint),
            formData,
            this.buildHttpOptions(requestOptions),
        );
    }

    put<T>(
        endpoint: string,
        body?: any,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const { cleanValue, requestOptions } = this.extractRequestOptions(
            body,
            options,
        );

        return this.http.put<ApiResponse<T>>(
            this.buildUrl(endpoint),
            cleanValue,
            this.buildHttpOptions(requestOptions),
        );
    }

    putFormData<T>(
        endpoint: string,
        formData: FormData,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const requestOptions = this.extractFormDataRequestOptions(
            formData,
            options,
        );

        return this.http.put<ApiResponse<T>>(
            this.buildUrl(endpoint),
            formData,
            this.buildHttpOptions(requestOptions),
        );
    }

    patch<T>(
        endpoint: string,
        body?: any,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const { cleanValue, requestOptions } = this.extractRequestOptions(
            body,
            options,
        );

        return this.http.patch<ApiResponse<T>>(
            this.buildUrl(endpoint),
            cleanValue,
            this.buildHttpOptions(requestOptions),
        );
    }

    patchFormData<T>(
        endpoint: string,
        formData: FormData,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        const requestOptions = this.extractFormDataRequestOptions(
            formData,
            options,
        );

        return this.http.patch<ApiResponse<T>>(
            this.buildUrl(endpoint),
            formData,
            this.buildHttpOptions(requestOptions),
        );
    }

    delete<T>(
        endpoint: string,
        options?: ApiRequestOptions,
    ): Observable<ApiResponse<T>> {
        return this.http.delete<ApiResponse<T>>(
            this.buildUrl(endpoint),
            this.buildHttpOptions(options),
        );
    }

    createFormData(data: Record<string, any>): FormData {
        const formData = new FormData();

        Object.entries(data).forEach(([key, value]) => {
            this.appendFormDataValue(formData, key, value);
        });

        return formData;
    }

    fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.readAsDataURL(file);

            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    }

    async filesToBase64Array(files: File[]): Promise<string[]> {
        return Promise.all(files.map((file) => this.fileToBase64(file)));
    }

    extractBase64FromDataURL(dataURL: string): string {
        const base64Marker = ';base64,';
        const base64Index = dataURL.indexOf(base64Marker);

        if (base64Index !== -1) {
            return dataURL.substring(base64Index + base64Marker.length);
        }

        return dataURL;
    }

    private buildUrl(endpoint: string): string {
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            return endpoint;
        }

        return `${this.baseUrl}${endpoint}`;
    }

    private buildParams(params?: Record<string, any>): HttpParams {
        let httpParams = new HttpParams();

        if (!params) return httpParams;

        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            if (key === 'recaptchaToken' || key === 'recaptchaAction') return;

            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (item !== null && item !== undefined && item !== '') {
                        httpParams = httpParams.append(key, String(item));
                    }
                });

                return;
            }

            httpParams = httpParams.set(key, String(value));
        });

        return httpParams;
    }

    private extractRequestOptions(
        value?: any,
        options?: ApiRequestOptions,
    ): {
        cleanValue: any;
        requestOptions: ApiRequestOptions;
    } {
        if (!value || typeof value !== 'object' || value instanceof FormData) {
            return {
                cleanValue: value,
                requestOptions: options ?? {},
            };
        }

        const {
            recaptchaToken: tokenFromValue,
            recaptchaAction: actionFromValue,
            ...cleanValue
        } = value;

        return {
            cleanValue,
            requestOptions: {
                ...options,
                recaptchaToken: options?.recaptchaToken ?? tokenFromValue ?? null,
                recaptchaAction: options?.recaptchaAction ?? actionFromValue ?? null,
            },
        };
    }

    private extractFormDataRequestOptions(
        formData: FormData,
        options?: ApiRequestOptions,
    ): ApiRequestOptions {
        const recaptchaToken =
            options?.recaptchaToken ??
            formData.get('x-recaptcha-token')?.toString() ??
            null;

        const recaptchaAction =
            options?.recaptchaAction ??
            formData.get('x-recaptcha-action')?.toString() ??
            null;

        formData.delete('x-recaptcha-token');
        formData.delete('x-recaptcha-action');

        return {
            ...options,
            recaptchaToken,
            recaptchaAction,
        };
    }

    private buildHttpOptions(options?: ApiRequestOptions): {
        headers: HttpHeaders;
        withCredentials: boolean;
        context: HttpContext;
    } {
        let headers = new HttpHeaders();

        if (options?.recaptchaToken) {
            headers = headers.set('x-recaptcha-token', options.recaptchaToken);
        }

        if (options?.recaptchaAction) {
            headers = headers.set('x-recaptcha-action', options.recaptchaAction);
        }

        const withCredentials = options?.credentials ?? true;

        return {
            headers,
            withCredentials,
            context: new HttpContext().set(WITH_CREDENTIALS, withCredentials),
        };
    }

    private appendFormDataValue(
        formData: FormData,
        key: string,
        value: any,
    ): void {
        if (value === null || value === undefined || value === '') return;

        if (value instanceof File || value instanceof Blob) {
            formData.append(key, value);
            return;
        }

        if (value instanceof FileList) {
            Array.from(value).forEach((file) => {
                formData.append(key, file);
            });

            return;
        }

        if (Array.isArray(value)) {
            if (!value.length) return;

            const hasFile = value.some(
                (item) => item instanceof File || item instanceof Blob,
            );

            if (hasFile) {
                value.forEach((item) => {
                    if (item instanceof File || item instanceof Blob) {
                        formData.append(key, item);
                    }
                });

                return;
            }

            formData.append(key, JSON.stringify(value));
            return;
        }

        if (typeof value === 'object' && !(value instanceof Date)) {
            formData.append(key, JSON.stringify(value));
            return;
        }

        formData.append(key, String(value));
    }
}
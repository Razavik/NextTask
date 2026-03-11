import type { AxiosRequestConfig } from "axios";
import { api } from "./axios";
import { buildApiUrl, type ApiPathParams, type ApiQueryParams } from "./api.utils";

interface RequestOptions {
	pathParams?: ApiPathParams;
	query?: ApiQueryParams;
	config?: AxiosRequestConfig;
}

class ApiService {
	private resolveUrl(route: string, options?: RequestOptions) {
		return buildApiUrl(route, options?.pathParams, options?.query);
	}

	async get<TResponse>(route: string, options?: RequestOptions): Promise<TResponse> {
		const response = await api.get<TResponse>(
			this.resolveUrl(route, options),
			options?.config,
		);
		return response.data;
	}

	async post<TResponse, TBody = unknown>(
		route: string,
		body?: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		const response = await api.post<TResponse>(
			this.resolveUrl(route, options),
			body,
			options?.config,
		);
		return response.data;
	}

	async put<TResponse, TBody = unknown>(
		route: string,
		body?: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		const response = await api.put<TResponse>(
			this.resolveUrl(route, options),
			body,
			options?.config,
		);
		return response.data;
	}

	async patch<TResponse, TBody = unknown>(
		route: string,
		body?: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		const response = await api.patch<TResponse>(
			this.resolveUrl(route, options),
			body,
			options?.config,
		);
		return response.data;
	}

	async delete<TResponse = void, TBody = unknown>(
		route: string,
		body?: TBody,
		options?: RequestOptions,
	): Promise<TResponse> {
		const response = await api.delete<TResponse>(this.resolveUrl(route, options), {
			...(options?.config ?? {}),
			data: body,
		});
		return response.data;
	}
}

export const apiService = new ApiService();
export type { RequestOptions as ApiRequestOptions };

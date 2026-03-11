type Primitive = string | number | boolean | null | undefined;
export type ApiPathParams = Record<string, Primitive>;
export type ApiQueryValue = Primitive | Primitive[];
export type ApiQueryParams = Record<string, ApiQueryValue>;

const normalizeValue = (value: Primitive) => {
	if (value === null || value === undefined) {
		return "";
	}

	return String(value);
};

export const buildApiUrl = (
	route: string,
	pathParams?: ApiPathParams,
	query?: ApiQueryParams,
) => {
	let url = route;

	if (pathParams) {
		for (const [key, value] of Object.entries(pathParams)) {
			url = url.replace(`:${key}`, encodeURIComponent(normalizeValue(value)));
		}
	}

	if (!query) {
		return url;
	}

	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(query)) {
		if (value === null || value === undefined || value === "") {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (item === null || item === undefined || item === "") {
					continue;
				}
				searchParams.append(key, normalizeValue(item));
			}
			continue;
		}

		searchParams.append(key, normalizeValue(value));
	}

	const queryString = searchParams.toString();
	return queryString ? `${url}?${queryString}` : url;
};

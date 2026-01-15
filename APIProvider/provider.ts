/**
 * provider.ts
 *
 * Data provider for TMDB API integration.
 * Handles movie and TV show data retrieval from themoviedb.org API
 */
import { requestUrl } from "obsidian";
import {
	TMDBSuggestItem,
	TMDBFullInfo,
} from "Models/TMDB_response";
import { MovieShow } from "Models/MovieShow.model";
import { ErrorHandler } from "APIProvider/ErrorHandler";
import { DataFormatter } from "APIProvider/DataFormatter";
import { ApiValidator } from "APIProvider/ApiValidator";
import { ImageInfo } from "Views/image_selection_modal";
import { t, tWithParams } from "../i18n";

const API_BASE_URL = "https://api.themoviedb.org/3";
const MAX_SEARCH_RESULTS = 20;
const LANGUAGE = "ru-RU";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export class TMDBProvider {
	private errorHandler: ErrorHandler;
	private dataFormatter: DataFormatter;
	private validator: ApiValidator;

	constructor(settings?: {
		actorsPath: string;
		directorsPath: string;
		writersPath: string;
		producersPath: string;
	}) {
		this.errorHandler = new ErrorHandler();
		this.dataFormatter = new DataFormatter();
		this.validator = new ApiValidator();

		if (settings) {
			this.dataFormatter.setSettings(settings);
		}
	}

	/**
	 * Performs HTTP GET request to TMDB API
	 */
	private async apiGet<T>(
		endpoint: string,
		token: string,
		params: Record<string, string | number> = {}
	): Promise<T> {
		if (!this.validator.isValidToken(token)) {
			throw new Error(t("provider.tokenRequired"));
		}

		params.language = LANGUAGE;
		const url = this.buildUrl(endpoint, params);

		try {
			const res = await requestUrl({
				url,
				method: 'GET',
				headers: {
					accept: 'application/json',
					Authorization: 'Bearer ' + token
				},
			});

			return res.json as T;
		} catch (error: unknown) {
			throw this.errorHandler.handleApiError(error);
		}
	}

	/**
	 * Builds URL with query parameters
	 */
	private buildUrl(
		endpoint: string,
		params: Record<string, string | number>
	): string {
		const url = new URL(`${API_BASE_URL}${endpoint}`);

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== "") {
				url.searchParams.set(key, value.toString());
			}
		}

		return url.href;
	}

	/**
	 * Calculate relevance score for search result
	 */
	private calculateRelevanceScore(item: any, query: string): number {
		const normalizedQuery = query.toLowerCase().trim();
		const title = (item.title || item.name || '').toLowerCase();
		const originalTitle = (item.original_title || item.original_name || '').toLowerCase();

		let score = 0;

		if (title === normalizedQuery || originalTitle === normalizedQuery) {
			score += 1000;
		}

		if (title.startsWith(normalizedQuery) || originalTitle.startsWith(normalizedQuery)) {
			score += 500;
		}

		if (title.includes(normalizedQuery) || originalTitle.includes(normalizedQuery)) {
			score += 250;
		}

		score += (item.vote_average || 0) * 10;
		score += (item.popularity || 0) * 0.1;

		return score;
	}

	/**
	 * Search for movies and TV shows by query
	 */
	public async searchByQuery(
		query: string,
		token: string
	): Promise<TMDBSuggestItem[]> {
		if (!this.validator.isValidSearchQuery(query)) {
			throw new Error(t("provider.enterMovieTitle"));
		}

		const [movieResults, tvResults] = await Promise.all([
			this.searchMovies(query, token),
			this.searchTVShows(query, token)
		]);

		const combined = [...movieResults, ...tvResults]
			.map(item => ({
				item,
				score: this.calculateRelevanceScore({
					title: item.name,
					original_title: item.alternativeName,
					vote_average: item.rating?.tmdb || 0,
					popularity: item.rating?.imdb || 0
				}, query)
			}))
			.sort((a, b) => b.score - a.score)
			.map(entry => entry.item)
			.slice(0, MAX_SEARCH_RESULTS);

		if (combined.length === 0) {
			throw new Error(
				tWithParams("provider.nothingFound", { query }) +
				" " +
				t("provider.tryChangeQuery")
			);
		}

		return combined;
	}

	/**
	 * Search for movies only
	 */
	private async searchMovies(
		query: string,
		token: string
	): Promise<TMDBSuggestItem[]> {
		const response = await this.apiGet<any>(
			"/search/movie",
			token,
			{
				query: query.trim(),
				page: 1
			}
		);

		return (response.results || []).map((item: any) => this.convertToSuggestItem(item, 'movie'));
	}

	/**
	 * Search for TV shows only
	 */
	private async searchTVShows(
		query: string,
		token: string
	): Promise<TMDBSuggestItem[]> {
		const response = await this.apiGet<any>(
			"/search/tv",
			token,
			{
				query: query.trim(),
				page: 1
			}
		);

		return (response.results || []).map((item: any) => this.convertToSuggestItem(item, 'tv-series'));
	}

	/**
	 * Get all available images for a movie/TV show
	 */
	public async getAllImages(id: number, token: string, type?: string): Promise<{
		posters: ImageInfo[];
		backdrops: ImageInfo[];
		logos: ImageInfo[];
	}> {
		try {
			const endpoint = type === 'tv-series' ? `/tv/${id}/images` : `/movie/${id}/images`;
			const images = await this.apiGet<any>(endpoint, token, {
				include_image_language: 'ru,en,null'
			});

			const extractImageData = (imageArray: any[] = []): ImageInfo[] => {
				return imageArray
					.map((img: any) => ({
						url: `${IMAGE_BASE_URL}original${img.file_path}`,
						language: img.iso_639_1 || undefined
					}))
					.filter((img) => img.url && img.url.trim() !== '');
			};

			return {
				posters: extractImageData(images.posters),
				backdrops: extractImageData(images.backdrops),
				logos: extractImageData(images.logos)
			};
		} catch (error) {
			console.error('Error fetching all images:', error);
			return { posters: [], backdrops: [], logos: [] };
		}
	}

	/**
	 * Convert TMDB search result to TMDBSuggestItem format
	 */
	private convertToSuggestItem(item: any, type: string): TMDBSuggestItem {
		const title = item.title || item.name || '';
		const originalTitle = item.original_title || item.original_name || '';
		const year = item.release_date || item.first_air_date || '';

		return {
			id: item.id,
			name: title,
			alternativeName: originalTitle,
			type: type,
			year: year ? parseInt(year.substring(0, 4)) : 0,
			poster: item.poster_path ? {
				url: `${IMAGE_BASE_URL}w500${item.poster_path}`,
				previewUrl: `${IMAGE_BASE_URL}w185${item.poster_path}`
			} : undefined,
			rating: {
				tmdb: item.vote_average || 0,
				imdb: item.vote_average || 0
			}
		};
	}

	/**
	 * Retrieves detailed movie/TV show information by ID and type
	 */
	public async getMovieById(id: number, token: string, type?: string, userRating?: number): Promise<MovieShow> {
		if (!this.validator.isValidMovieId(id)) {
			throw new Error(t("provider.invalidMovieId"));
		}

		if (!this.validator.isValidToken(token)) {
			throw new Error(t("provider.tokenRequiredForMovie"));
		}

		if (type === 'tv-series') {
			const tvData = await this.getTVShowDetails(id, token);
			return this.dataFormatter.createMovieShowFrom(tvData, userRating);
		} else if (type === 'movie') {
			const movieData = await this.getMovieDetails(id, token);
			return this.dataFormatter.createMovieShowFrom(movieData, userRating);
		}

		// Fallback: try as movie first, then as TV show if fails
		try {
			const movieData = await this.getMovieDetails(id, token);
			return this.dataFormatter.createMovieShowFrom(movieData, userRating);
		} catch (error) {
			const tvData = await this.getTVShowDetails(id, token);
			return this.dataFormatter.createMovieShowFrom(tvData, userRating);
		}
	}

	/**
	 * Get movie details from TMDB
	 */
	private async getMovieDetails(id: number, token: string): Promise<TMDBFullInfo> {
		const [details, credits, images] = await Promise.all([
			this.apiGet<any>(`/movie/${id}`, token, {
				append_to_response: 'videos,external_ids,alternative_titles,release_dates'
			}),
			this.apiGet<any>(`/movie/${id}/credits`, token, {}),
			this.apiGet<any>(`/movie/${id}/images`, token, {
				include_image_language: 'ru,en,null'
			})
		]);

		return this.dataFormatter.convertMovieToTMDBFormat(details, credits, images);
	}

	/**
	 * Get TV show details from TMDB
	 */
	private async getTVShowDetails(id: number, token: string): Promise<TMDBFullInfo> {
		const [details, credits, images] = await Promise.all([
			this.apiGet<any>(`/tv/${id}`, token, {
				append_to_response: 'videos,external_ids,alternative_titles,content_ratings'
			}),
			this.apiGet<any>(`/tv/${id}/credits`, token, {}),
			this.apiGet<any>(`/tv/${id}/images`, token, {
				include_image_language: 'ru,en,null'
			})
		]);

		return this.dataFormatter.convertTVShowToTMDBFormat(details, credits, images);
	}

	/**
	 * Validates API token by making test request
	 */
	public async validateToken(token: string): Promise<boolean> {
		if (!this.validator.isValidToken(token)) {
			return false;
		}

		try {
			await this.apiGet<any>("/configuration", token, {});
			return true;
		} catch {
			return false;
		}
	}
}

// Legacy compatibility functions
const provider = new TMDBProvider();

export async function getByQuery(
	query: string,
	token: string
): Promise<TMDBSuggestItem[]> {
	return provider.searchByQuery(query, token);
}

export async function getMovieShowById(
	id: number,
	token: string
): Promise<MovieShow> {
	return provider.getMovieById(id, token);
}

export async function validateApiToken(token: string): Promise<boolean> {
	return provider.validateToken(token);
}
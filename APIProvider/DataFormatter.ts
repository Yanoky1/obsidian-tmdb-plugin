/**
 * DataFormatter.ts
 *
 * Formats TMDB API data for use in Obsidian templates
 * Includes TMDB conversion utilities and constants
 */

import {
	TMDBFullInfo,
	TMDBPerson,
	TMDBSimpleItem,     // Добавлено
	TMDBRelatedMovie,  // Добавлено
	TMDBName           // Добавлено
} from "Models/TMDB_response";
import { MovieShow } from "Models/MovieShow.model";
import { capitalizeFirstLetter } from "Utils/utils";

const MAX_ARRAY_ITEMS = 50;
const MAX_FACTS_COUNT = 5;

// TMDB API Configuration
const TMDB_CONFIG = {
	IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
	SIZES: {
		POSTER_ORIGINAL: 'original',
		POSTER_W500: 'w500',
		POSTER_W185: 'w185',
		BACKDROP_ORIGINAL: 'original',
		BACKDROP_W1280: 'w1280',
		PROFILE_W185: 'w185',
	},
} as const;

// Age Rating Mappings
const AGE_RATING_MAP = {
	MOVIE: {
		'G': 0,
		'PG': 6,
		'PG-13': 13,
		'R': 17,
		'NC-17': 18
	},
	TV: {
		'TV-Y': 0,
		'TV-Y7': 7,
		'TV-G': 0,
		'TV-PG': 10,
		'TV-14': 14,
		'TV-MA': 17
	}
} as const;

// Profession Mappings
const PROFESSION_MAP = {
	'Director': { enProfession: 'director', profession: 'режиссер' },
	'Writer': { enProfession: 'writer', profession: 'сценарист' },
	'Screenplay': { enProfession: 'writer', profession: 'сценарист' },
	'Producer': { enProfession: 'producer', profession: 'продюсер' },
	'Executive Producer': { enProfession: 'producer', profession: 'продюсер' }
} as const;

// Content type translations to Russian
const TYPE_TRANSLATIONS: Record<string, string> = {
	"animated-series": "Анимационный сериал",
	anime: "Аниме",
	cartoon: "Мультфильм",
	movie: "Фильм",
	"tv-series": "Сериал",
} as const;

// HTML entities for decoding
const HTML_ENTITIES: Record<string, string> = {
	"&laquo;": "«",
	"&raquo;": "»",
	"&ldquo;": '"',
	"&rdquo;": '"',
	"&lsquo;": "'",
	"&rsquo;": "'",
	"&quot;": '"',
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&nbsp;": " ",
	"&ndash;": "–",
	"&mdash;": "—",
	"&hellip;": "…",
} as const;

enum FormatType {
	SHORT_VALUE = "short",
	LONG_TEXT = "long",
	URL = "url",
	LINK = "link",
	LINK_WITH_PATH = "link_with_path",
	LINK_ID_WITH_PATH = "link_id_with_path",
}

export class DataFormatter {
	private settings?: {
		actorsPath: string;
		directorsPath: string;
		writersPath: string;
		producersPath: string;
	};

	/**
	 * Set settings for path support
	 */
	public setSettings(settings: {
		actorsPath: string;
		directorsPath: string;
		writersPath: string;
		producersPath: string;
	}): void {
		this.settings = settings;
	}

	/**
	 * Build TMDB image URL
	 */
	private buildImageUrl(path: string, size: string): string {
		return `${TMDB_CONFIG.IMAGE_BASE_URL}${size}${path}`;
	}

	/**
	 * Extract best image by language priority (ru -> en -> any)
	 */
	private extractBestImage(images: any[], type: 'logo' | 'poster' | 'backdrop'): any | undefined {
		if (!images || images.length === 0) {
			return undefined;
		}

		// Сначала ищем русский
		const ruImage = images.find((img: any) => img.iso_639_1 === 'ru');
		if (ruImage) {
			return {
				url: this.buildImageUrl(ruImage.file_path, TMDB_CONFIG.SIZES.POSTER_ORIGINAL),
				previewUrl: this.buildImageUrl(ruImage.file_path, TMDB_CONFIG.SIZES.POSTER_W500)
			};
		}

		// Потом английский
		const enImage = images.find((img: any) => img.iso_639_1 === 'en');
		if (enImage) {
			return {
				url: this.buildImageUrl(enImage.file_path, TMDB_CONFIG.SIZES.POSTER_ORIGINAL),
				previewUrl: this.buildImageUrl(enImage.file_path, TMDB_CONFIG.SIZES.POSTER_W500)
			};
		}

		// Или любой другой
		const anyImage = images[0];
		return {
			url: this.buildImageUrl(anyImage.file_path, TMDB_CONFIG.SIZES.POSTER_ORIGINAL),
			previewUrl: this.buildImageUrl(anyImage.file_path, TMDB_CONFIG.SIZES.POSTER_W500)
		};
	}

	/**
	 * Convert TMDB credits to persons format
	 */
	private convertCreditsToPersons(credits: any): any[] {
		const persons: any[] = [];

		// Add cast (actors)
		(credits.cast || []).slice(0, 20).forEach((person: any) => {
			persons.push({
				id: person.id,
				name: person.name,
				enName: person.original_name || person.name,
				enProfession: 'actor',
				profession: 'актер',
				photo: person.profile_path
					? this.buildImageUrl(person.profile_path, TMDB_CONFIG.SIZES.PROFILE_W185)
					: undefined
			});
		});

		// Add crew (directors, writers, producers)
		(credits.crew || []).forEach((person: any) => {
			const mapping = PROFESSION_MAP[person.job as keyof typeof PROFESSION_MAP];

			if (!mapping && person.department === 'Writing') {
				persons.push({
					id: person.id,
					name: person.name,
					enName: person.original_name || person.name,
					enProfession: 'writer',
					profession: 'сценарист',
					photo: person.profile_path
						? this.buildImageUrl(person.profile_path, TMDB_CONFIG.SIZES.PROFILE_W185)
						: undefined
				});
			} else if (mapping) {
				persons.push({
					id: person.id,
					name: person.name,
					enName: person.original_name || person.name,
					enProfession: mapping.enProfession,
					profession: mapping.profession,
					photo: person.profile_path
						? this.buildImageUrl(person.profile_path, TMDB_CONFIG.SIZES.PROFILE_W185)
						: undefined
				});
			}
		});

		return persons;
	}

	/**
	 * Extract age rating from TMDB release dates
	 */
	private extractAgeRating(releaseDates: any): number {
		if (!releaseDates?.results) return 0;

		const usRelease = releaseDates.results.find((r: any) => r.iso_3166_1 === 'US');
		if (usRelease?.release_dates?.[0]?.certification) {
			const cert = usRelease.release_dates[0].certification;
			return AGE_RATING_MAP.MOVIE[cert as keyof typeof AGE_RATING_MAP.MOVIE] || 0;
		}

		return 0;
	}

	/**
	 * Extract MPAA rating string
	 */
	private extractMpaaRating(releaseDates: any): string {
		if (!releaseDates?.results) return '';

		const usRelease = releaseDates.results.find((r: any) => r.iso_3166_1 === 'US');
		return usRelease?.release_dates?.[0]?.certification || '';
	}

	/**
	 * Extract age rating for TV shows
	 */
	private extractTVAgeRating(contentRatings: any): number {
		if (!contentRatings?.results) return 0;

		const usRating = contentRatings.results.find((r: any) => r.iso_3166_1 === 'US');
		if (usRating?.rating) {
			return AGE_RATING_MAP.TV[usRating.rating as keyof typeof AGE_RATING_MAP.TV] || 0;
		}

		return 0;
	}

	/**
	 * Convert TMDB movie data to TMDBFullInfo format
	 */
	public convertMovieToTMDBFormat(details: any, credits: any, images: any): TMDBFullInfo {
		const year = details.release_date ? parseInt(details.release_date.substring(0, 4)) : 0;

		// Используем изображения из images endpoint, если доступны
		const poster = images?.posters?.length > 0
			? this.extractBestImage(images.posters, 'poster')
			: (details.poster_path ? {
				url: this.buildImageUrl(details.poster_path, TMDB_CONFIG.SIZES.POSTER_ORIGINAL),
				previewUrl: this.buildImageUrl(details.poster_path, TMDB_CONFIG.SIZES.POSTER_W500)
			} : undefined);

		const backdrop = images?.backdrops?.length > 0
			? this.extractBestImage(images.backdrops, 'backdrop')
			: (details.backdrop_path ? {
				url: this.buildImageUrl(details.backdrop_path, TMDB_CONFIG.SIZES.BACKDROP_ORIGINAL),
				previewUrl: this.buildImageUrl(details.backdrop_path, TMDB_CONFIG.SIZES.BACKDROP_W1280)
			} : undefined);

		const logo = images?.logos?.length > 0
			? this.extractBestImage(images.logos, 'logo')
			: undefined;

		return {
			id: details.id,
			name: details.title || '',
			alternativeName: details.original_title || '',
			enName: details.original_language === 'en' ? details.original_title : details.title,
			type: 'movie',
			year: year,
			description: details.overview || '',
			shortDescription: details.tagline || '',
			poster: poster,
			backdrop: backdrop,
			logo: logo,
			genres: (details.genres || []).map((g: any) => ({ name: g.name })),
			countries: (details.production_countries || []).map((c: any) => ({ name: c.name })),
			persons: this.convertCreditsToPersons(credits),
			movieLength: details.runtime || 0,
			isSeries: false,
			TMDBLink: details.homepage,
			rating: {
				tmdb: details.vote_average || 0,
				imdb: details.vote_average || 0
			},
			votes: {
				tmdb: details.vote_count || 0,
				imdb: details.vote_count || 0
			},
			externalId: {
				imdb: details.imdb_id,
				tmdb: details.id
			},
			slogan: details.tagline,
			budget: details.budget ? {
				value: details.budget,
				currency: 'USD'
			} : undefined,
			fees: details.revenue ? {
				world: {
					value: details.revenue,
					currency: 'USD'
				}
			} : undefined,
			premiere: {
				world: details.release_date
			},
			ageRating: this.extractAgeRating(details.release_dates),
			ratingMpaa: this.extractMpaaRating(details.release_dates),
			productionCompanies: (details.production_companies || []).map((c: any) => ({
				name: c.name
			})),
			networks: details.networks ? {
				items: details.networks.map((n: any) => ({ name: n.name }))
			} : undefined,
			names: details.alternative_titles?.titles?.map((t: any) => ({
				name: t.title,
				type: t.type
			})) || []
		} as TMDBFullInfo;
	}

	/**
	 * Convert TMDB TV show data to TMDBFullInfo format
	 */
	public convertTVShowToTMDBFormat(details: any, credits: any, images: any): TMDBFullInfo {
		const year = details.first_air_date ? parseInt(details.first_air_date.substring(0, 4)) : 0;

		// Используем изображения из images endpoint, если доступны
		const poster = images?.posters?.length > 0
			? this.extractBestImage(images.posters, 'poster')
			: (details.poster_path ? {
				url: this.buildImageUrl(details.poster_path, TMDB_CONFIG.SIZES.POSTER_ORIGINAL),
				previewUrl: this.buildImageUrl(details.poster_path, TMDB_CONFIG.SIZES.POSTER_W500)
			} : undefined);

		const backdrop = images?.backdrops?.length > 0
			? this.extractBestImage(images.backdrops, 'backdrop')
			: (details.backdrop_path ? {
				url: this.buildImageUrl(details.backdrop_path, TMDB_CONFIG.SIZES.BACKDROP_ORIGINAL),
				previewUrl: this.buildImageUrl(details.backdrop_path, TMDB_CONFIG.SIZES.BACKDROP_W1280)
			} : undefined);

		const logo = images?.logos?.length > 0
			? this.extractBestImage(images.logos, 'logo')
			: undefined;

		return {
			id: details.id,
			name: details.name || '',
			alternativeName: details.original_name || '',
			enName: details.original_language === 'en' ? details.original_name : details.name,
			type: 'tv-series',
			year: year,
			description: details.overview || '',
			shortDescription: details.tagline || '',
			poster: poster,
			backdrop: backdrop,
			logo: logo,
			genres: (details.genres || []).map((g: any) => ({ name: g.name })),
			countries: (details.production_countries || []).map((c: any) => ({ name: c.name })),
			persons: this.convertCreditsToPersons(credits),
			isSeries: true,
			TMDBLink: details.homepage,
			seriesLength: details.episode_run_time?.[0] || 0,
			totalSeriesLength: (details.number_of_episodes || 0) * (details.episode_run_time?.[0] || 0),
			status: details.status,
			seasonsInfo: (details.seasons || [])
				.filter((s: any) => s.season_number > 0) // Исключаем спецвыпуски (сезон 0)
				.map((s: any) => ({
					number: s.season_number,
					episodesCount: s.episode_count
				})),
			rating: {
				tmdb: details.vote_average || 0,
				imdb: details.vote_average || 0
			},
			votes: {
				tmdb: details.vote_count || 0,
				imdb: details.vote_count || 0
			},
			externalId: {
				imdb: details.external_ids?.imdb_id,
				tmdb: details.id
			},
			premiere: {
				world: details.first_air_date
			},
			releaseYears: [{
				start: year,
				end: details.last_air_date ? parseInt(details.last_air_date.substring(0, 4)) : undefined
			}],
			ageRating: this.extractTVAgeRating(details.content_ratings),
			productionCompanies: (details.production_companies || []).map((c: any) => ({
				name: c.name
			})),
			networks: {
				items: (details.networks || []).map((n: any) => ({ name: n.name }))
			},
			names: details.alternative_titles?.results?.map((t: any) => ({
				name: t.title,
				type: t.type
			})) || []
		} as TMDBFullInfo;
	}

	/**
	 * Transforms API data into MovieShow format
	 */
	public createMovieShowFrom(fullInfo: TMDBFullInfo, userRating?: number): MovieShow {
		const seasonsData = this.calculateSeasonsData(fullInfo.seasonsInfo);
		const people = this.extractPeople(fullInfo.persons || []);
		const companies = this.extractCompanies(fullInfo);
		const facts = this.processFacts(fullInfo.facts || []);
		const names = this.processNames(fullInfo);

		const firstReleaseYear = fullInfo.releaseYears?.[0];

		const item: MovieShow = {
			// Basic information
			id: fullInfo.id,
			name: this.formatArray([fullInfo.name], FormatType.SHORT_VALUE),
			alternativeName: this.formatArray(
				[fullInfo.alternativeName || ""],
				FormatType.SHORT_VALUE
			),
			year: fullInfo.year,
			description: this.formatArray(
				[fullInfo.description || ""],
				FormatType.LONG_TEXT
			),
			shortDescription: this.formatArray(
				[fullInfo.shortDescription || ""],
				FormatType.LONG_TEXT
			),

			// Additional properties for filenames
			nameForFile: this.cleanTextForMetadata(fullInfo.name),
			alternativeNameForFile: this.cleanTextForMetadata(
				fullInfo.alternativeName || ""
			),
			enNameForFile: this.cleanTextForMetadata(fullInfo.enName || ""),

			// TMDB Link
			TMDBLink: this.formatArray(
				[`https://www.themoviedb.org/${fullInfo.type === 'tv-series' ? 'tv' : 'movie'}/${fullInfo.id}`],
				FormatType.URL
			),

			// Images
			posterUrl: this.formatArray(
				[fullInfo.poster?.url || ""],
				FormatType.URL
			),
			coverUrl: this.formatArray(
				[fullInfo.backdrop?.url || ""],
				FormatType.URL
			),
			logoUrl: this.formatArray(
				[fullInfo.logo?.url || ""],
				FormatType.URL
			),

			// Ready-to-use image links for Obsidian
			posterMarkdown: this.createImageLink(fullInfo.poster?.url || ""),
			coverMarkdown: this.createImageLink(fullInfo.backdrop?.url || ""),
			logoMarkdown: this.createImageLink(fullInfo.logo?.url || ""),

			// Clean image paths for template sizing
			posterPath: [],
			coverPath: [],
			logoPath: [],
			coverPathMobile: [],

			// Classification
			genres: this.formatArray(
				fullInfo.genres.map((g: TMDBSimpleItem) => capitalizeFirstLetter(g.name)),
				FormatType.SHORT_VALUE
			),
			genresLinks: this.formatArray(
				fullInfo.genres.map((g: TMDBSimpleItem) => capitalizeFirstLetter(g.name)),
				FormatType.LINK
			),
			countries: this.formatArray(
				fullInfo.countries.map((c: TMDBSimpleItem) => c.name),
				FormatType.SHORT_VALUE
			),
			countriesLinks: this.formatArray(
				fullInfo.countries.map((c: TMDBSimpleItem) => c.name),
				FormatType.LINK
			),
			type: this.formatArray(
				[this.translateType(fullInfo.type || "")],
				FormatType.SHORT_VALUE
			),
			subType: this.formatArray(
				[fullInfo.subType || ""],
				FormatType.SHORT_VALUE
			),

			// People
			director: this.formatArray(people.directors, FormatType.SHORT_VALUE),
			directorsLinks: this.formatArray(people.directors, FormatType.LINK),
			directorsLinksWithPath: this.formatArray(
				people.directors,
				FormatType.LINK_WITH_PATH,
				this.settings?.directorsPath
			),
			directorsIdsWithPath: this.formatArray(
				people.directors,
				FormatType.LINK_ID_WITH_PATH,
				this.settings?.directorsPath
			),

			actors: this.formatArray(people.actors, FormatType.SHORT_VALUE),
			actorsLinks: this.formatArray(people.actors, FormatType.LINK),
			actorsLinksWithPath: this.formatArray(
				people.actors,
				FormatType.LINK_WITH_PATH,
				this.settings?.actorsPath
			),
			actorsIdsWithPath: this.formatArray(
				people.actors,
				FormatType.LINK_ID_WITH_PATH,
				this.settings?.actorsPath
			),

			writers: this.formatArray(people.writers, FormatType.SHORT_VALUE),
			writersLinks: this.formatArray(people.writers, FormatType.LINK),
			writersLinksWithPath: this.formatArray(
				people.writers,
				FormatType.LINK_WITH_PATH,
				this.settings?.writersPath
			),
			writersIdsWithPath: this.formatArray(
				people.writers,
				FormatType.LINK_ID_WITH_PATH,
				this.settings?.writersPath
			),

			producers: this.formatArray(people.producers, FormatType.SHORT_VALUE),
			producersLinks: this.formatArray(people.producers, FormatType.LINK),
			producersLinksWithPath: this.formatArray(
				people.producers,
				FormatType.LINK_WITH_PATH,
				this.settings?.producersPath
			),
			producersIdsWithPath: this.formatArray(
				people.producers,
				FormatType.LINK_ID_WITH_PATH,
				this.settings?.producersPath
			),

			// Technical specifications
			movieLength: fullInfo.movieLength || 0,
			isSeries: fullInfo.isSeries,
			seriesLength: fullInfo.seriesLength || 0,
			totalSeriesLength: fullInfo.totalSeriesLength || 0,
			isComplete: fullInfo.isSeries
				? (fullInfo.status === "Ended" || fullInfo.status === "Canceled" ? "Завершен" : "В эфире")
				: "Вышел",
			seasonsCount: seasonsData.count,
			seriesInSeasonCount: seasonsData.averageEpisodesPerSeason,

			// Ratings and votes
			ratingTmdb: fullInfo.rating?.tmdb ? Number(fullInfo.rating?.tmdb?.toFixed(1)) : 0,
			ratingImdb: fullInfo.rating?.imdb ? Number(fullInfo.rating?.imdb?.toFixed(1)) : 0,
			ratingFilmCritics: fullInfo.rating?.filmCritics || 0,
			ratingRussianFilmCritics: fullInfo.rating?.russianFilmCritics || 0,
			votesTmdb: fullInfo.votes?.tmdb || 0,
			votesImdb: fullInfo.votes?.imdb || 0,
			votesFilmCritics: fullInfo.votes?.filmCritics || 0,
			votesRussianFilmCritics: fullInfo.votes?.russianFilmCritics || 0,

			// External IDs and links
			TMDBUrl: this.formatArray(
				[`https://www.themoviedb.org/${fullInfo.type === 'tv-series' ? 'tv' : 'movie'}/${fullInfo.id}`],
				FormatType.URL
			),
			imdbId: this.formatArray(
				[fullInfo.externalId?.imdb || ""],
				FormatType.SHORT_VALUE
			),
			tmdbId: fullInfo.externalId?.tmdb || 0,

			// Additional information
			slogan: this.formatArray(
				[fullInfo.slogan || ""],
				FormatType.LONG_TEXT
			),
			ageRating: fullInfo.ageRating || 0,
			ratingMpaa: this.formatArray(
				[fullInfo.ratingMpaa || ""],
				FormatType.SHORT_VALUE
			),
			// Status - initially empty, will be set separately
			status: this.formatArray([""], FormatType.SHORT_VALUE),

			// Financial data
			budgetValue: fullInfo.budget?.value || 0,
			budgetCurrency: this.formatArray(
				[fullInfo.budget?.currency || ""],
				FormatType.SHORT_VALUE
			),
			feesWorldValue: fullInfo.fees?.world?.value || 0,
			feesWorldCurrency: this.formatArray(
				[fullInfo.fees?.world?.currency || ""],
				FormatType.SHORT_VALUE
			),
			feesRussiaValue: fullInfo.fees?.russia?.value || 0,
			feesRussiaCurrency: this.formatArray(
				[fullInfo.fees?.russia?.currency || ""],
				FormatType.SHORT_VALUE
			),
			feesUsaValue: fullInfo.fees?.usa?.value || 0,
			feesUsaCurrency: this.formatArray(
				[fullInfo.fees?.usa?.currency || ""],
				FormatType.SHORT_VALUE
			),

			// Premiere dates
			premiereWorld: this.formatArray(
				[this.formatDate(fullInfo.premiere?.world)],
				FormatType.SHORT_VALUE
			),
			premiereRussia: this.formatArray(
				[this.formatDate(fullInfo.premiere?.russia)],
				FormatType.SHORT_VALUE
			),
			premiereDigital: this.formatArray(
				[this.formatDate(fullInfo.premiere?.digital)],
				FormatType.SHORT_VALUE
			),
			premiereCinema: this.formatArray(
				[this.formatDate(fullInfo.premiere?.cinema)],
				FormatType.SHORT_VALUE
			),

			// Release years
			releaseYearsStart: firstReleaseYear?.start || 0,
			releaseYearsEnd: firstReleaseYear?.end || 0,

			// Top ratings
			top10: fullInfo.top10 || 0,
			top250: fullInfo.top250 || 0,

			// Facts
			facts: this.formatArray(facts, FormatType.LONG_TEXT),

			// Alternative names
			allNamesString: this.formatArray(
				names.allNames,
				FormatType.SHORT_VALUE
			),
			enName: this.formatArray(
				[fullInfo.enName || ""],
				FormatType.SHORT_VALUE
			),

			// Networks and companies
			networks: this.formatArray(
				companies.networks,
				FormatType.SHORT_VALUE
			),
			networksLinks: this.formatArray(
				companies.networks,
				FormatType.LINK
			),
			productionCompanies: this.formatArray(
				companies.productionCompanies,
				FormatType.SHORT_VALUE
			),
			productionCompaniesLinks: this.formatArray(
				companies.productionCompanies,
				FormatType.LINK
			),

			// Distributors
			distributor: this.formatArray(
				[fullInfo.distributors?.distributor || ""],
				FormatType.SHORT_VALUE
			),
			distributorRelease: this.formatArray(
				[
					this.formatDate(
						fullInfo.distributors?.distributorRelease
					) ||
					fullInfo.distributors?.distributorRelease ||
					"",
				],
				FormatType.SHORT_VALUE
			),

			// Related movies/series
			sequelsAndPrequels: this.formatArray(
				companies.sequelsAndPrequels,
				FormatType.SHORT_VALUE
			),
			sequelsAndPrequelsLinks: this.formatArray(
				companies.sequelsAndPrequels,
				FormatType.LINK
			),
		};

		// Add user rating if provided
		if (userRating !== undefined) {
			(item as any).userRating = userRating;
		}

		return item;
	}

	/**
	 * Universal array formatting based on type
	 */
	private formatArray(
		items: string[] | Array<{ name: string; id?: number }>,
		formatType: FormatType,
		folderPath?: string,
		maxItems: number = MAX_ARRAY_ITEMS
	): string[] {
		if (formatType === FormatType.LINK_ID_WITH_PATH) {
			const personItems = items as Array<{ name: string; id?: number }>;
			return personItems
				.filter((item) => item.name && item.name.trim() !== "")
				.slice(0, maxItems)
				.map((item) => {
					const cleanName = this.cleanTextForMetadata(item.name);
					if (folderPath && folderPath.trim() !== "" && item.id) {
						return `"[[${folderPath}/${item.id}|${cleanName}]]"`;
					} else if (item.id) {
						return `"[[${item.id}|${cleanName}]]"`;
					}
					return `"[[${cleanName}]]"`;
				});
		}

		const stringItems = (items as any[]).map(item =>
			typeof item === 'object' && item.name ? item.name : item
		);

		const filteredItems = stringItems
			.filter((item): item is string => typeof item === 'string' && item.trim() !== "")
			.slice(0, maxItems);

		switch (formatType) {
			case FormatType.SHORT_VALUE:
				return filteredItems.map((item) =>
					this.cleanTextForMetadata(item)
				);

			case FormatType.LONG_TEXT:
				return filteredItems.map((item) => {
					const cleanedItem = item
						.replace(/\n/g, " ")
						.replace(/\s+/g, " ")
						.trim();
					return `"${cleanedItem}"`;
				});

			case FormatType.URL:
				return filteredItems.map((item) => item.trim());

			case FormatType.LINK:
				return filteredItems.map((item) => {
					const cleanName = this.cleanTextForMetadata(item);
					return `"[[${cleanName}]]"`;
				});

			case FormatType.LINK_WITH_PATH:
				return filteredItems.map((item) => {
					const cleanName = this.cleanTextForMetadata(item);
					if (folderPath && folderPath.trim() !== "") {
						return `"[[${folderPath}/${cleanName}]]"`;
					}
					return `"[[${cleanName}]]"`;
				});

			default:
				return filteredItems;
		}
	}

	/**
	 * Calculates seasons data from seasons info
	 */
	private calculateSeasonsData(
		seasonsInfo?: Array<{ episodesCount: number }>
	): {
		count: number;
		averageEpisodesPerSeason: number;
	} {
		if (!seasonsInfo || seasonsInfo.length === 0) {
			return { count: 0, averageEpisodesPerSeason: 0 };
		}

		const totalEpisodes = seasonsInfo.reduce(
			(total, season) => total + season.episodesCount,
			0
		);
		const averageEpisodes = Math.ceil(totalEpisodes / seasonsInfo.length);

		return {
			count: seasonsInfo.length,
			averageEpisodesPerSeason: averageEpisodes,
		};
	}

	/**
	 * Extracts people by profession from persons array
	 */
	private extractPeople(persons: TMDBPerson[]): {
		directors: Array<{ name: string; id?: number }>;
		actors: Array<{ name: string; id?: number }>;
		writers: Array<{ name: string; id?: number }>;
		producers: Array<{ name: string; id?: number }>;
	} {
		const result = {
			directors: [] as Array<{ name: string; id?: number }>,
			actors: [] as Array<{ name: string; id?: number }>,
			writers: [] as Array<{ name: string; id?: number }>,
			producers: [] as Array<{ name: string; id?: number }>,
		};

		for (const person of persons) {
			if (!person.name || !person.enProfession) continue;

			const personData = { name: person.name, id: person.id };

			switch (person.enProfession) {
				case "director":
					result.directors.push(personData);
					break;
				case "actor":
					result.actors.push(personData);
					break;
				case "writer":
					result.writers.push(personData);
					break;
				case "producer":
					result.producers.push(personData);
					break;
			}
		}

		return result;
	}

	/**
	 * Extracts companies and related movies from API response
	 */
	private extractCompanies(fullInfo: TMDBFullInfo): {
		networks: string[];
		productionCompanies: string[];
		sequelsAndPrequels: string[];
	} {
		const networks =
			fullInfo.networks?.items
				?.map((network: TMDBSimpleItem) => network.name)
				.filter((name) => name && name.trim() !== "") || [];

		const productionCompanies =
			fullInfo.productionCompanies
				?.map((company) => company.name)
				.filter((name) => name && name.trim() !== "") || [];

		const sequelsAndPrequels =
			fullInfo.sequelsAndPrequels
				?.map((movie: TMDBRelatedMovie) => movie.name)
				.filter((name) => name && name.trim() !== "") || [];

		return { networks, productionCompanies, sequelsAndPrequels };
	}

	/**
	 * Processes facts by removing spoilers and HTML tags
	 */
	private processFacts(
		facts: Array<{ spoiler?: boolean; value: string }>
	): string[] {
		return facts
			.filter(
				(fact) =>
					!fact.spoiler && fact.value && fact.value.trim() !== ""
			)
			.slice(0, MAX_FACTS_COUNT)
			.map((fact) => this.stripHtmlTags(fact.value));
	}

	private processNames(fullInfo: TMDBFullInfo): {
		allNames: string[];
	} {
		const allNames =
			fullInfo.names
				?.map((nameObj: TMDBName) => nameObj.name)
				.filter((name) => name && name.trim() !== "") || [];

		return { allNames };
	}

	/**
	 * Formats date to Obsidian format (YYYY-MM-DD)
	 */
	private formatDate(dateString?: string): string {
		if (!dateString) return "";

		try {
			const date = new Date(dateString);

			if (
				isNaN(date.getTime()) ||
				date.getFullYear() < 1800 ||
				date.getFullYear() > 2100
			) {
				return "";
			}

			return date.toISOString().split("T")[0];
		} catch {
			return "";
		}
	}

	/**
	 * Cleans text from characters that might break metadata
	 */
	private cleanTextForMetadata(text: string): string {
		if (!text) return "";
		return text.replace(/:/g, "").trim();
	}

	/**
	 * Creates image link for Obsidian format
	 */
	private createImageLink(imagePath: string): string[] {
		if (!imagePath || imagePath.trim() === "") return [];

		if (!imagePath.startsWith("http")) {
			return [`![[${imagePath}]]`];
		}

		return [`![](${imagePath})`];
	}

	private translateType(type: string): string {
		return TYPE_TRANSLATIONS[type] || type;
	}

	/**
	 * Removes HTML tags and decodes HTML entities
	 */
	private stripHtmlTags(text: string): string {
		let cleanText = text.replace(/<[^>]*>/g, "");

		for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
			cleanText = cleanText.replace(new RegExp(entity, "g"), char);
		}

		cleanText = cleanText.replace(/&#?\w+;/g, "");

		return cleanText.trim();
	}
}
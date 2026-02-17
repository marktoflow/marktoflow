/**
 * Example: Custom Weather API integration for marktoflow.
 *
 * This shows how to create a user-defined SDK integration that can be
 * used in workflow YAML files like any built-in integration.
 *
 * Usage in workflow:
 *   tools:
 *     weather:
 *       sdk: 'weather-api'
 *       auth:
 *         api_key: '${WEATHER_API_KEY}'
 *
 *   steps:
 *     - id: get-weather
 *       action: weather-api.getCurrent
 *       inputs:
 *         city: 'San Francisco'
 */

import { defineIntegration } from '@marktoflow/core';

export default defineIntegration({
  name: 'weather-api',
  description: 'Fetch weather data from wttr.in (no API key required for basic usage)',

  validate(config) {
    const errors: string[] = [];
    // wttr.in doesn't require an API key, but if users provide one we accept it
    if (config.options?.['baseUrl'] && typeof config.options['baseUrl'] !== 'string') {
      errors.push('options.baseUrl must be a string');
    }
    return errors;
  },

  async initialize(config) {
    const baseUrl = (config.options?.['baseUrl'] as string) || 'https://wttr.in';

    return {
      /**
       * Get current weather for a city.
       */
      getCurrent: async (inputs: Record<string, unknown>) => {
        const city = inputs.city as string;
        if (!city) throw new Error('weather-api.getCurrent requires inputs.city');

        const url = `${baseUrl}/${encodeURIComponent(city)}?format=j1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API error: ${res.status} ${res.statusText}`);

        const data = (await res.json()) as Record<string, unknown>;
        const current = (data.current_condition as Record<string, unknown>[])?.[0];

        return {
          city,
          temperature_c: current?.temp_C,
          temperature_f: current?.temp_F,
          description: (current?.weatherDesc as Record<string, unknown>[])?.[0]?.value,
          humidity: current?.humidity,
          wind_speed_kmph: current?.windspeedKmph,
          feels_like_c: current?.FeelsLikeC,
        };
      },

      /**
       * Get a simple text forecast.
       */
      getForecast: async (inputs: Record<string, unknown>) => {
        const city = inputs.city as string;
        const days = (inputs.days as number) || 3;
        if (!city) throw new Error('weather-api.getForecast requires inputs.city');

        const url = `${baseUrl}/${encodeURIComponent(city)}?format=j1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API error: ${res.status} ${res.statusText}`);

        const data = (await res.json()) as Record<string, unknown>;
        const weather = (data.weather as Record<string, unknown>[]) || [];

        return {
          city,
          forecast: weather.slice(0, days).map((day) => ({
            date: day.date,
            max_temp_c: day.maxtempC,
            min_temp_c: day.mintempC,
            description: (day.hourly as Record<string, unknown>[])?.[4]?.weatherDesc,
          })),
        };
      },
    };
  },
});

import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Hello World worker', () => {
	it('responds with usage message (unit style)', async () => {
		const request = new Request('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toContain('Usage: POST /analyze');
	});

	it('responds with usage message (integration style)', async () => {
		const response = await SELF.fetch('http://example.com');
		expect(await response.text()).toContain('Usage: POST /analyze');
	});
});

// ----------------------------------------------------
// Translation Endpoint Tests
// ----------------------------------------------------
describe('Translation API', () => {
	describe('POST /translate', () => {
		it('should translate English title to Japanese', async () => {
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Breaking News: Market hits record high' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty('translated', true);
			expect(data).toHaveProperty('title_ja');
			expect(typeof data.title_ja).toBe('string');
			expect(data.title_ja.length).toBeGreaterThan(0);
		});

		it('should skip translation for Japanese text', async () => {
			const japaneseTitle = '速報：市場が過去最高値を更新';
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: japaneseTitle })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty('translated', false);
			expect(data).toHaveProperty('title_ja', japaneseTitle);
		});

		it('should handle empty title gracefully', async () => {
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: '' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Should handle empty title - either return original or error
			expect([200, 400, 500]).toContain(response.status);
		});

		it('should return 400 for missing title parameter', async () => {
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
		});

		it('should handle translation failure gracefully', async () => {
			// Very long title that might cause timeout or error
			const longTitle = 'A'.repeat(10000);
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: longTitle })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Should not crash - either succeed with truncated result or handle error
			expect([200, 500]).toContain(response.status);

			if (response.status === 200) {
				const data = await response.json();
				expect(data).toHaveProperty('title_ja');
			}
		});

		it('should handle mixed Japanese-English text', async () => {
			const mixedTitle = '株価が上昇、Stock Market Rally';
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: mixedTitle })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const data = await response.json();
			// If contains Japanese, should not translate
			if (data.translated === false) {
				expect(data.title_ja).toBe(mixedTitle);
			}
		});

		it('should handle special characters in title', async () => {
			const specialTitle = 'Breaking: "Market" Up! <Test>';
			const request = new Request('http://internal/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: specialTitle })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty('title_ja');
			expect(typeof data.title_ja).toBe('string');
		});
	});
});

import { describe, it, expect } from 'vitest';
import { keywordMatchScore, rescoreWithProfile, PROFILE } from '../functions/api/_profile.js';

const profile = PROFILE;

describe('keywordMatchScore', () => {
  it('returns 0 for empty/null title', () => {
    expect(keywordMatchScore('', profile)).toBe(0);
    expect(keywordMatchScore(null, profile)).toBe(0);
    expect(keywordMatchScore('テストタイトル', null)).toBe(0);
  });

  it('returns 0 for title with no keyword matches', () => {
    expect(keywordMatchScore('今日はいい天気ですね', profile)).toBe(0);
  });

  it('returns > 0 for title matching a positive keyword', () => {
    const score = keywordMatchScore('AI AgentによるエンタープライズDXの推進', profile);
    expect(score).toBeGreaterThan(0);
  });

  it('returns higher score for cross-domain matches', () => {
    const single = keywordMatchScore('Cloudflare Workersの新機能リリース', profile);
    const cross = keywordMatchScore('Cloudflare WorkersでエンタープライズDXを実現するAI Agent基盤', profile);
    expect(cross).toBeGreaterThan(single);
  });

  it('reduces score for negative keyword matches', () => {
    const clean = keywordMatchScore('LLMを活用したビジネス戦略', profile);
    const neg = keywordMatchScore('個人向けガジェットレビュー: LLMを活用したビジネス戦略', profile);
    expect(neg).toBeLessThan(clean);
  });
});

describe('rescoreWithProfile', () => {
  it('returns llmScore when no keywords match', () => {
    expect(rescoreWithProfile('今日の天気', 60, profile)).toBe(60);
  });

  it('boosts score for positive keyword match', () => {
    const rescored = rescoreWithProfile('AI Agentの最新動向', 50, profile);
    expect(rescored).toBeGreaterThan(50);
  });

  it('gives score even when LLM fails (score=0)', () => {
    const rescored = rescoreWithProfile('Cloudflare WorkersでRAG構築', 0, profile);
    expect(rescored).toBeGreaterThan(0);
  });

  it('adds cross-domain bonus when 2+ domains match', () => {
    const single = rescoreWithProfile('Next.jsの新機能', 50, profile);
    const cross = rescoreWithProfile('Next.jsで財務ガバナンスの基盤構築', 50, profile);
    expect(cross - single).toBeGreaterThanOrEqual(20);
  });

  it('reduces score for negative keywords', () => {
    const clean = rescoreWithProfile('LLMの最新動向', 70, profile);
    const neg = rescoreWithProfile('個人向けガジェットレビュー: LLMの最新動向', 70, profile);
    expect(neg).toBeLessThan(clean);
  });

  it('clamps score to 0-100', () => {
    const high = rescoreWithProfile('AI Agent Cloudflare Workers エンタープライズDX RAG 財務ガバナンス', 100, profile);
    expect(high).toBeLessThanOrEqual(100);
    const low = rescoreWithProfile('個人向けガジェットレビュー B2C向け単発キャンペーン 暗号資産の価格変動', 0, profile);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

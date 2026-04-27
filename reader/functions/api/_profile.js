const PROFILE = {
  user_interest_profile: {
    core_identity: {
      profession: ["CPA", "Consulting Partner", "Cross-border Business Leader"],
      primary_targets: ["Enterprise", "CFO", "CIO", "VC (Venture Capital)"],
      market_focus: ["Japan", "China", "APAC"]
    },
    domains_and_weights: {
      business_and_strategy: {
        weight: 1.5,
        positive_keywords: [
          "クロスボーダー", "海外進出", "エンタープライズDX", "基幹システム再構築",
          "財務ガバナンス", "データコンプライアンス", "B2Bマーケティング", "リードジェネレーション"
        ]
      },
      technology_and_architecture: {
        weight: 1.5,
        positive_keywords: [
          "Vibe Coding", "AI Agent", "Agentic Workflow", "LLM", "Claude", "GLM-5", "Qwen",
          "Cloudflare", "Cloudflare Workers", "Cloudflare R2", "Cloudflare D1",
          "Next.js", "Supabase", "自動化パイプライン", "RAG"
        ]
      },
      conceptual_and_social_systems: {
        weight: 1.2,
        positive_keywords: [
          "社会システム理論", "ニクラス・ルーマン", "自己言及", "エコシステム",
          "デジタルカルト", "宗教のメカニズム", "コミュニティ形成", "ブランド構築"
        ]
      },
      lifestyle_and_niche: {
        weight: 0.8,
        positive_keywords: [
          "バレーボール", "スポーツ大会運営", "ベテラン向けコミュニティ",
          "分解遊び", "STEM教育", "機械式時計", "カメラの構造"
        ]
      }
    },
    filtering_rules: {
      negative_keywords: [
        "B2C向け単発キャンペーン", "個人向けガジェットレビュー", "暗号資産の価格変動"
      ]
    }
  }
};

export { PROFILE };

export function keywordMatchScore(title, profile) {
  if (!title || !profile) return 0;

  const domains = profile.user_interest_profile.domains_and_weights;
  const negativeKeywords = profile.user_interest_profile.filtering_rules.negative_keywords;

  let rawScore = 0;
  let matchedDomains = 0;

  for (const [, domain] of Object.entries(domains)) {
    let domainMatches = 0;
    for (const kw of domain.positive_keywords) {
      if (title.includes(kw)) {
        domainMatches++;
      }
    }
    if (domainMatches > 0) {
      rawScore += domainMatches * domain.weight;
      matchedDomains++;
    }
  }

  for (const nk of negativeKeywords) {
    if (title.includes(nk)) {
      rawScore -= 1.5;
    }
  }

  const normalized = Math.max(0, Math.min(1, rawScore / 8));
  return normalized;
}

export function rescoreWithProfile(title, llmScore, profile) {
  if (!title || !profile) return llmScore || 0;

  const domains = profile.user_interest_profile.domains_and_weights;
  const negativeKeywords = profile.user_interest_profile.filtering_rules.negative_keywords;

  let keywordBoost = 0;
  let matchedDomains = 0;

  for (const [, domain] of Object.entries(domains)) {
    let domainMatches = 0;
    for (const kw of domain.positive_keywords) {
      if (title.includes(kw)) {
        domainMatches++;
      }
    }
    if (domainMatches > 0) {
      keywordBoost += domainMatches * domain.weight * 15;
      matchedDomains++;
    }
  }

  keywordBoost = Math.min(keywordBoost, 40);

  const crossDomainBonus = matchedDomains >= 2 ? 20 : 0;

  let negativePenalty = 0;
  for (const nk of negativeKeywords) {
    if (title.includes(nk)) {
      negativePenalty += 30;
    }
  }

  const rescored = (llmScore || 0) + keywordBoost + crossDomainBonus - negativePenalty;
  return Math.max(0, Math.min(100, Math.round(rescored)));
}

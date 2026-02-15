---
workflow:
  id: multi-agent-consensus
  name: Multi-Agent Consensus Decision
  description: Gather diverse AI perspectives and synthesize a consensus recommendation

inputs:
  decision_topic:
    type: string
    description: The decision or question to analyze
  context:
    type: string
    description: Additional context for the decision
  options:
    type: array
    description: List of options to evaluate (optional)
    required: false

steps:
  # Step 1: Gather opinions from multiple agents in parallel
  - id: gather_opinions
    action: parallel.spawn
    inputs:
      agents:
        # Conservative agent (Claude Opus - detail-oriented)
        - id: conservative_analysis
          provider: claude
          model: opus
          prompt: |
            Analyze this decision from a conservative, risk-averse perspective:

            **Decision:** {{ inputs.decision_topic }}

            **Context:**
            {{ inputs.context }}

            {% if inputs.options %}
            **Options:**
            {% for option in inputs.options %}
            - {{ option }}
            {% endfor %}
            {% endif %}

            Provide:
            1. Risk analysis for each option
            2. Potential downsides and failure modes
            3. Long-term implications
            4. Your recommendation with rationale
            5. Confidence level (0-100%)

            Be thorough and cautious. Consider what could go wrong.

            Respond in JSON:
            {
              "perspective": "conservative",
              "analysis": "...",
              "risks": ["..."],
              "recommendation": "...",
              "confidence": <0-100>
            }

        # Innovative agent (GPT-4 - creative thinking)
        - id: innovative_analysis
          provider: copilot
          model: gpt-4
          prompt: |
            Analyze this decision from an innovative, opportunity-focused perspective:

            **Decision:** {{ inputs.decision_topic }}

            **Context:**
            {{ inputs.context }}

            {% if inputs.options %}
            **Options:**
            {% for option in inputs.options %}
            - {{ option }}
            {% endfor %}
            {% endif %}

            Provide:
            1. Opportunities and upside potential
            2. Innovative approaches not obvious at first
            3. Future trends this aligns with
            4. Your recommendation with rationale
            5. Confidence level (0-100%)

            Think creatively. What's possible?

            Respond in JSON:
            {
              "perspective": "innovative",
              "analysis": "...",
              "opportunities": ["..."],
              "recommendation": "...",
              "confidence": <0-100>
            }

        # Pragmatic agent (Claude Haiku - practical, fast)
        - id: pragmatic_analysis
          provider: claude
          model: haiku
          prompt: |
            Analyze this decision from a pragmatic, implementation-focused perspective:

            **Decision:** {{ inputs.decision_topic }}

            **Context:**
            {{ inputs.context }}

            {% if inputs.options %}
            **Options:**
            {% for option in inputs.options %}
            - {{ option }}
            {% endfor %}
            {% endif %}

            Provide:
            1. Implementation feasibility
            2. Resource requirements (time, money, people)
            3. Quick wins vs long-term plays
            4. Your recommendation with rationale
            5. Confidence level (0-100%)

            Be practical. What can actually be done?

            Respond in JSON:
            {
              "perspective": "pragmatic",
              "analysis": "...",
              "feasibility": "...",
              "recommendation": "...",
              "confidence": <0-100>
            }

        # Data-driven agent (local Ollama - analytical)
        - id: data_analysis
          provider: ollama
          model: llama3
          prompt: |
            Analyze this decision from a data-driven, analytical perspective:

            **Decision:** {{ inputs.decision_topic }}

            **Context:**
            {{ inputs.context }}

            {% if inputs.options %}
            **Options:**
            {% for option in inputs.options %}
            - {{ option }}
            {% endfor %}
            {% endif %}

            Provide:
            1. Key metrics to measure success
            2. Data points needed for informed decision
            3. Historical patterns or precedents
            4. Your recommendation with rationale
            5. Confidence level (0-100%)

            Be analytical. What does the data suggest?

            Respond in JSON:
            {
              "perspective": "analytical",
              "analysis": "...",
              "metrics": ["..."],
              "recommendation": "...",
              "confidence": <0-100>
            }

      wait: majority  # Need at least 3 out of 4 agents to succeed
      timeout: 90s
      onError: partial  # Accept partial results

    output_variable: opinions

  # Step 2: Synthesize consensus with meta-agent
  - id: synthesize_consensus
    action: claude.chat.completions
    inputs:
      model: opus  # Use best model for synthesis
      messages:
        - role: user
          content: |
            You are a decision synthesis expert. Review these AI agent opinions and create a consensus recommendation.

            **Decision Topic:** {{ inputs.decision_topic }}

            **Agent Opinions:**
            {{ opinions | tojson(indent=2) }}

            Create a synthesized recommendation that:
            1. Identifies areas of consensus
            2. Highlights important dissenting views
            3. Balances all perspectives
            4. Provides clear, actionable recommendation
            5. Includes confidence level and caveats

            Format as structured markdown report.
    output_variable: synthesis_result

outputs:
  consensus_report: "{{ synthesis_result.choices[0].message.content }}"
  agent_opinions: "{{ opinions }}"
---

# Consensus Decision Making

This workflow demonstrates gathering opinions from multiple AI agents with different models and providers to reach a consensus decision.

## Usage

```bash
# Business decision
./marktoflow run examples/parallel-agents/consensus-decision.md \
  --input decision_topic="Should we migrate to microservices?" \
  --input context="Current monolith has 200k lines, 10 developers, 3-year roadmap" \
  --input options='["Full migration", "Hybrid approach", "Stay monolith"]'

# Technical decision
./marktoflow run examples/parallel-agents/consensus-decision.md \
  --input decision_topic="Which database for user analytics?" \
  --input context="500k DAU, real-time dashboards needed, budget: $5k/mo" \
  --input options='["PostgreSQL", "MongoDB", "ClickHouse", "BigQuery"]'

# Product decision
./marktoflow run examples/parallel-agents/consensus-decision.md \
  --input decision_topic="Should we add AI features to the product?" \
  --input context="B2B SaaS, enterprise customers, 80% margins"
```

## Output

The workflow generates:

1. **Individual perspectives** from 4 different agents/models
2. **Consensus metrics** (agreement level, confidence)
3. **Synthesized recommendation** balancing all views
4. **Decision scorecard** with metadata
5. **Saved decision record** in `decisions/` folder

## Decision Quality Indicators

| Consensus Level | Interpretation | Action |
|----------------|----------------|--------|
| 90-100% | Strong consensus | High confidence to proceed |
| 70-89% | Moderate consensus | Proceed with noted caveats |
| 50-69% | Weak consensus | Further analysis needed |
| <50% | No consensus | Re-evaluate or gather more data |

## Benefits

- **Diverse perspectives**: Multiple models bring different strengths
- **Reduced bias**: No single model dominates the decision
- **Quality indicator**: Consensus level shows decision certainty
- **Transparent**: All agent reasoning is preserved
- **Auditable**: Full decision record saved for later review

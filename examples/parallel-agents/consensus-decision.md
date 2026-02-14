# Consensus Decision Making

This workflow demonstrates gathering opinions from multiple AI agents with different models and providers to reach a consensus decision.

```yaml
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
    
    outputs:
      opinions: {{ results }}
      agent_count: {{ successful | length }}

  # Step 2: Analyze agreement level
  - id: analyze_consensus
    action: core.set
    inputs:
      all_recommendations: |
        {% set recs = [] %}
        {% for agent_id, result in opinions.results.items() %}
          {% if result.success %}
            {% set _ = recs.append(result.output.recommendation) %}
          {% endif %}
        {% endfor %}
        {{ recs }}
      
      avg_confidence: |
        {% set confidences = [] %}
        {% for agent_id, result in opinions.results.items() %}
          {% if result.success %}
            {% set _ = confidences.append(result.output.confidence) %}
          {% endif %}
        {% endfor %}
        {{ confidences | avg }}
      
      agreement_level: |
        {% set recs = all_recommendations %}
        {% if recs | length == 0 %}
          0
        {% else %}
          {% set most_common = recs | groupby | sort(attribute='1.length') | last %}
          {{ (most_common[1] | length / recs | length) * 100 }}
        {% endif %}

  # Step 3: Synthesize consensus with meta-agent
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
            
            1. **Conservative Perspective (Risk-focused):**
            {{ opinions.results.conservative_analysis.output | json }}
            
            2. **Innovative Perspective (Opportunity-focused):**
            {{ opinions.results.innovative_analysis.output | json }}
            
            3. **Pragmatic Perspective (Implementation-focused):**
            {{ opinions.results.pragmatic_analysis.output | json }}
            
            {% if opinions.results.data_analysis.success %}
            4. **Analytical Perspective (Data-driven):**
            {{ opinions.results.data_analysis.output | json }}
            {% endif %}
            
            **Agreement Level:** {{ agreement_level }}%
            **Average Confidence:** {{ avg_confidence }}%
            
            Create a synthesized recommendation that:
            1. Identifies areas of consensus
            2. Highlights important dissenting views
            3. Balances all perspectives
            4. Provides clear, actionable recommendation
            5. Includes confidence level and caveats
            
            Format as structured markdown report.
    outputs:
      consensus_report: {{ output.choices[0].message.content }}

  # Step 4: Generate decision scorecard
  - id: create_scorecard
    action: core.set
    inputs:
      scorecard:
        topic: {{ inputs.decision_topic }}
        perspectives_gathered: {{ agent_count }}
        consensus_level: {{ agreement_level }}
        average_confidence: {{ avg_confidence }}
        processing_time_ms: {{ opinions.timing.duration }}
        total_cost: {{ opinions.costs.total }}
        individual_costs: {{ opinions.costs.byAgent }}
        recommendations:
          conservative: {{ opinions.results.conservative_analysis.output.recommendation }}
          innovative: {{ opinions.results.innovative_analysis.output.recommendation }}
          pragmatic: {{ opinions.results.pragmatic_analysis.output.recommendation }}
          analytical: {{ opinions.results.data_analysis.output.recommendation }}
        synthesis: {{ consensus_report }}

  # Step 5: Save decision record
  - id: save_decision
    action: file.write
    inputs:
      path: decisions/{{ inputs.decision_topic | slugify }}-{{ now() | date('YYYY-MM-DD') }}.md
      content: |
        # Decision Analysis: {{ inputs.decision_topic }}
        
        **Date:** {{ now() | date('YYYY-MM-DD HH:mm:ss') }}
        **Consensus Level:** {{ agreement_level }}%
        **Average Confidence:** {{ avg_confidence }}%
        
        ## Context
        
        {{ inputs.context }}
        
        ## Multi-Agent Analysis
        
        ### Conservative Perspective (Risk Management)
        {{ opinions.results.conservative_analysis.output.analysis }}
        
        **Recommendation:** {{ opinions.results.conservative_analysis.output.recommendation }}
        **Confidence:** {{ opinions.results.conservative_analysis.output.confidence }}%
        
        ---
        
        ### Innovative Perspective (Opportunity Focus)
        {{ opinions.results.innovative_analysis.output.analysis }}
        
        **Recommendation:** {{ opinions.results.innovative_analysis.output.recommendation }}
        **Confidence:** {{ opinions.results.innovative_analysis.output.confidence }}%
        
        ---
        
        ### Pragmatic Perspective (Implementation)
        {{ opinions.results.pragmatic_analysis.output.analysis }}
        
        **Recommendation:** {{ opinions.results.pragmatic_analysis.output.recommendation }}
        **Confidence:** {{ opinions.results.pragmatic_analysis.output.confidence }}%
        
        ---
        
        ### Analytical Perspective (Data-Driven)
        {{ opinions.results.data_analysis.output.analysis }}
        
        **Recommendation:** {{ opinions.results.data_analysis.output.recommendation }}
        **Confidence:** {{ opinions.results.data_analysis.output.confidence }}%
        
        ---
        
        ## Consensus Synthesis
        
        {{ consensus_report }}
        
        ---
        
        ## Metadata
        - Processing Time: {{ opinions.timing.duration }}ms
        - Total Cost: ${{ opinions.costs.total }}
        - Agents: {{ agent_count }} successful
        - Agreement: {{ agreement_level }}%

outputs:
  decision_file: {{ save_decision }}
  consensus_level: {{ agreement_level }}
  recommendation: {{ consensus_report }}
  scorecard: {{ scorecard }}
```

## Usage

```bash
# Business decision
marktoflow run examples/parallel-agents/consensus-decision.md \
  --input decision_topic="Should we migrate to microservices?" \
  --input context="Current monolith has 200k lines, 10 developers, 3-year roadmap" \
  --input options='["Full migration", "Hybrid approach", "Stay monolith"]'

# Technical decision
marktoflow run examples/parallel-agents/consensus-decision.md \
  --input decision_topic="Which database for user analytics?" \
  --input context="500k DAU, real-time dashboards needed, budget: $5k/mo" \
  --input options='["PostgreSQL", "MongoDB", "ClickHouse", "BigQuery"]'

# Product decision
marktoflow run examples/parallel-agents/consensus-decision.md \
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

## Advanced: Weighted Consensus

Assign different weights to agent perspectives:

```yaml
- id: weighted_consensus
  action: core.set
  inputs:
    weighted_score: |
      {% set conservative_weight = 0.3 %}
      {% set innovative_weight = 0.2 %}
      {% set pragmatic_weight = 0.4 %}
      {% set analytical_weight = 0.1 %}
      {{
        (opinions.results.conservative_analysis.output.confidence * conservative_weight) +
        (opinions.results.innovative_analysis.output.confidence * innovative_weight) +
        (opinions.results.pragmatic_analysis.output.confidence * pragmatic_weight) +
        (opinions.results.data_analysis.output.confidence * analytical_weight)
      }}
```

## Integration

Use this workflow in larger decision-making processes:

```yaml
# In a governance workflow
- id: ai_consensus
  workflow: examples/parallel-agents/consensus-decision.md
  inputs:
    decision_topic: {{ proposal.topic }}
    context: {{ proposal.context }}

- id: human_review
  action: wait
  mode: form
  fields:
    approve:
      type: boolean
      label: Approve AI recommendation?
    notes:
      type: text
      label: Additional notes
```

## Benefits

- **Diverse perspectives**: Multiple models bring different strengths
- **Reduced bias**: No single model dominates the decision
- **Quality indicator**: Consensus level shows decision certainty
- **Transparent**: All agent reasoning is preserved
- **Auditable**: Full decision record saved for later review

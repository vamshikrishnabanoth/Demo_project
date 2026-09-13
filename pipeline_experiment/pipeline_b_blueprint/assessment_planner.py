"""
Pipeline B: Layer 3 Assessment Plan Generator.
Allocates question quotas across blueprint topics using the largest remainder method based on salience mass.
"""

from typing import List
from pipeline_experiment.shared.schemas.canonical_models import (
    PedagogicalBlueprint,
    AssessmentPlan,
    AssessmentPlanAllocation
)


class AssessmentPlanner:
    @staticmethod
    def create_assessment_plan(
        blueprint: PedagogicalBlueprint,
        total_questions: int = 5
    ) -> AssessmentPlan:
        """
        Determines how many questions to allocate to each topic based on salience.
        """
        total_salience = sum(t.salience_score for t in blueprint.topics) or 1.0

        allocations: List[AssessmentPlanAllocation] = []
        counts = []
        remainders = []

        for idx, t in enumerate(blueprint.topics):
            exact_q = (t.salience_score / total_salience) * total_questions
            base_q = int(exact_q)
            rem = exact_q - base_q
            counts.append(base_q)
            remainders.append((rem, idx))
            allocations.append(AssessmentPlanAllocation(
                topic_id=t.topic_id,
                topic_name=t.topic,
                question_count=base_q,
                target_bloom=[t.target_bloom_level]
            ))

        # Distribute remainder
        leftover = total_questions - sum(counts)
        remainders.sort(key=lambda x: x[0], reverse=True)
        for i in range(leftover):
            idx = remainders[i % len(remainders)][1]
            allocations[idx].question_count += 1

        return AssessmentPlan(
            plan_id=f"PLAN_{blueprint.input_id}",
            input_id=blueprint.input_id,
            total_questions=total_questions,
            allocations=allocations
        )

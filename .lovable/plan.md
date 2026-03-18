

## Plan: Add "Cursos" Ranking Section

### Overview

Add a third ranking tab "Cursos" after "Vinhos" on the Ranking page. It ranks courses by number of completions (students who finished 100%), respecting the same period filters. Requires a new database function and frontend updates.

### 1. Database: Create `get_course_rankings` function

New SQL function that aggregates `matriculas` (where `completed_at IS NOT NULL`) joined with `cursos`, grouped by course, filtered by period.

Returns: `curso_id`, `titulo`, `nivel`, `tipo`, `capa_url`, `completion_count` (total_points).

```text
get_course_rankings(period text)
  → matriculas (completed_at >= since)
  → JOIN cursos
  → GROUP BY curso
  → ORDER BY completion_count DESC
  → LIMIT 100
```

### 2. Frontend: `src/pages/RankingPage.tsx`

- Extend `Section` type to `"membros" | "vinhos" | "cursos"`
- Add third filter button "Cursos" with `GraduationCap` icon, same styling as Membros/Vinhos
- Add `useQuery` for `get_course_rankings` RPC
- Add `CourseRankingEntry` interface with `curso_id`, `titulo`, `nivel`, `tipo`, `capa_url`, `completion_count`
- Add `CoursesRanking` component following same layout pattern:
  - Top 3 podium cards (showing course name, level, capa image or GraduationCap fallback)
  - Full table with columns: #, Curso, Conclusões (GraduationCap icon), Pts
- Update `isLoading` to handle the third section

### Files changed
- **Migration**: new `get_course_rankings` function
- **`src/pages/RankingPage.tsx`**: add button, query, and component

No other functionality is altered.


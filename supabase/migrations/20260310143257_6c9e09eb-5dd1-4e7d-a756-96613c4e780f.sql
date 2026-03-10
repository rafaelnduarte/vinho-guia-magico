-- Remove modulo_id from aulas
ALTER TABLE public.aulas DROP COLUMN modulo_id;

-- Remove modulo_id from progresso
ALTER TABLE public.progresso DROP COLUMN modulo_id;

-- Drop modulos table
DROP TABLE IF EXISTS public.modulos;
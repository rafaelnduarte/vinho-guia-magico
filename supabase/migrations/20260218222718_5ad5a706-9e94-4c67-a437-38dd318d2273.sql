
ALTER TABLE public.seals ADD CONSTRAINT seals_category_check CHECK (category = ANY (ARRAY['perfil_vinho'::text, 'perfil_cliente'::text]));

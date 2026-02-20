
ALTER TABLE public.wines ADD COLUMN drink_or_cellar text DEFAULT NULL;
COMMENT ON COLUMN public.wines.drink_or_cellar IS 'Recomendação: Beber, Guardar, ou Beber ou Guardar';

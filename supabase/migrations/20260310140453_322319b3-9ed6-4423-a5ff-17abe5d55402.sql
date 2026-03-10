ALTER TABLE public.cursos ADD CONSTRAINT cursos_panda_folder_id_key UNIQUE (panda_folder_id);
ALTER TABLE public.aulas ADD CONSTRAINT aulas_panda_video_id_key UNIQUE (panda_video_id);
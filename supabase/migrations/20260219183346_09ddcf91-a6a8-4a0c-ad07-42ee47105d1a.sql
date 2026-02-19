
-- Add aggregation method to metrics
CREATE TYPE public.aggregation_method AS ENUM ('best', 'average', 'latest');

ALTER TABLE public.metrics ADD COLUMN aggregation aggregation_method NOT NULL DEFAULT 'best';

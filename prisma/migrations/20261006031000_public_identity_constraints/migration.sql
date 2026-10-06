BEGIN;

-- Normalized storage gives handles case-insensitive uniqueness and stable URLs.
ALTER TABLE "InnovationProfile" ADD CONSTRAINT "InnovationProfile_handle_format"
CHECK ("handle" IS NULL OR (
  "handle" = lower("handle") AND char_length("handle") BETWEEN 3 AND 64
  AND "handle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
));

ALTER TABLE "Project" ADD CONSTRAINT "Project_publicSlug_format"
CHECK ("publicSlug" IS NULL OR (
  "publicSlug" = lower("publicSlug") AND char_length("publicSlug") BETWEEN 3 AND 64
  AND "publicSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
));

COMMIT;

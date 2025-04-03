-- migrate:up

ALTER TABLE app_public_v2.fda_counts ADD COLUMN moa TEXT default NULL;

-- migrate:down


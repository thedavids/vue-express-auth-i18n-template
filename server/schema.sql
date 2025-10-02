-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table Definition
CREATE TABLE "public"."User" (
    "id" uuid NOT NULL,
    "email" varchar(255),
    "displayName" varchar(255),
    "password" varchar(255),
    "googleId" varchar(255),
    "facebookId" varchar(255),
    "isVerified" bool DEFAULT false,
    "createdAt" timestamptz DEFAULT now(),
    "location" geography,
    "search_radius_m" int4,
    "base_address" text,
    "avatar_url" text,
    "avatar_key" text,
    "avatar_updated_at" timestamptz,
    "notifyUponRequestCreation" bool NOT NULL DEFAULT false,
    "stripe_customer_id" text,
    "notifyUponRequestCreationByEmail" bool NOT NULL DEFAULT false,
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);
CREATE UNIQUE INDEX "User_googleId_key" ON public."User" USING btree ("googleId");
CREATE UNIQUE INDEX "User_facebookId_key" ON public."User" USING btree ("facebookId");
CREATE INDEX users_location_gix ON public."User" USING gist (location);
CREATE INDEX users_location_notify_gix ON public."User" USING gist (location) WHERE (("notifyUponRequestCreation" = true) AND (search_radius_m IS NOT NULL));
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
    "location" geography, -- Requires PostGIS
    "search_radius_m" int4,
    "base_address" text,
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);
CREATE UNIQUE INDEX "User_googleId_key" ON public."User" USING btree ("googleId");
CREATE UNIQUE INDEX "User_facebookId_key" ON public."User" USING btree ("facebookId");
CREATE INDEX users_location_gix ON public."User" USING gist (location);
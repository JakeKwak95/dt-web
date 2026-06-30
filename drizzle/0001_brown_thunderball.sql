CREATE TABLE "studio_asset_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"obj_index" integer NOT NULL,
	CONSTRAINT "studio_asset_catalog_obj_index_unique" UNIQUE("obj_index")
);

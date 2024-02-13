import { Strapi } from "@strapi/strapi";
import _ from "lodash";
import type { Subscriber, Event } from "@strapi/database/dist/lifecycles/types";

const locationServiceUid = "plugin::location-plugin.locationServices";

const createSubscriber = (strapi: Strapi): Subscriber => {
  const db = strapi.db.connection;
  const modelsWithLocation =
    strapi.services[locationServiceUid].getModelsWithLocation();

  return {
    models: modelsWithLocation.map((model) => model.uid),

    afterCreate: async (event: Event) => {
      const { model } = event;
      const locationFields = strapi.services[
        locationServiceUid
      ].getLocationFields(model.attributes);

      const id = event?.state?.id;
      if (!id) return;

      await Promise.all(
        locationFields.map(async (locationField) => {
          const data = event.params.data[locationField];

          if (!data?.lng || !data?.lat) return;

          await db.raw(`
              UPDATE ${model.tableName}
              SET ${_.snakeCase(
                locationField
              )}_geom = ST_SetSRID(ST_MakePoint(${data.lng}, ${data.lat}), 4326)
              WHERE id = ${id};
          `);
        })
      );
    },
    afterUpdate: async (event: Event) => {
      const { model, params } = event;
      const locationFields = strapi.services[
        locationServiceUid
      ].getLocationFields(model.attributes);

      await Promise.all(
        locationFields.map(async (locationField) => {
          const data = params.data[locationField];
          if (!params.where.id || !data?.lng || !data?.lat) return;

          await db.raw(`
            UPDATE ${model.tableName}
            SET ${_.snakeCase(locationField)}_geom = ST_SetSRID(ST_MakePoint(${
            data.lng
          }, ${data.lat}), 4326)
            WHERE id = ${params.where.id};
          `);
        })
      );
    },
  };
};

export default createSubscriber;

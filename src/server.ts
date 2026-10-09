//encender en un puerto
import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(
    `API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`,
  );
});

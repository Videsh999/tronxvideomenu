# Environment files

Keep local environment files here. `envs/.env.example` is the only tracked environment file; actual values in `envs/.env` and `envs/.env.local` are ignored by Git.

Next.js reads `.env*` from the project root. For a fresh clone, create the local file and its root link:

```sh
cp envs/.env.example envs/.env.local
ln -s envs/.env.local .env.local
```

If you use a shared `envs/.env`, link it with `ln -s envs/.env .env`. The root `.env.example` is a tracked link to `envs/.env.example`.

Deployment platforms should continue to supply production secrets through their environment-variable settings. Do not commit populated environment files or copy production secrets into the repository.

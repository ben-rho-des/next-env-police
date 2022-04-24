# Next Env Police 🚓
searches a built nextjs static directory for an env variables not prefixed as public

## what is this
This is a cli tool to check a nextjs build directory for an env variables that might have slipped out.

It will look for any environment variables not prefixed with `NEXT_PUBLIC`, then search the .next/static directory for all .js files that contain the value of any of those variables. It will log out a warning in the console if it finds any -- this change be changed to throw via options.
## how to use

In your nextjs project you should have a `next build` script. simply tack an additional step onto the end of that, eg modify your build script in package.json to the following;

```
    "build": "next build && next-env-police",
```

## options (beta)

Create a `.next-env-police.json` with the following;

```
{
    "envs": [
        ".env"
    ],
    "ignoreVarsByPrefix": [
        "NEXT_PUBLIC"
    ],
    "dir": ".next/static",
    "verbose": false,
    "throws: "false
}
```

You can ad multiple .env files, if there are are multiple you want to check, such as .env.production.

If there are certain env variabes you wan to ignore, you can add them to ignoreVarsByPrefix. Note: code is checking if key.startsWith(ignoreVarsByPrefix[x])

Code only looks in `.next/static` by default. I doubt you want to check the server files, since the vars are likely needed there.

verbose option as true will log out additional info.

If throws option is true, will throw an error to bust a CI.

# tests

to test library internally;

```
yarn build
yarn start -o test/fixtures/.test.next-env-police.json
```
# ParaFlightLog Wing Library

Online catalog of paragliding wings for the ParaFlightLog iOS app.

## Structure

- `wings.json` - Wing catalog with manufacturers and models
- `images/` - Wing images (PNG with transparency, max 400x400)
- `admin/` - Web admin interface (GitHub Pages)

## Admin Interface

Access the admin interface at: https://xavierkain.github.io/paraflightlog-wings/admin/

### Setup

1. Create a GitHub Personal Access Token with `repo` permissions
2. Open the admin interface
3. Click "Se connecter" and enter your token
4. Add, edit, or delete wings as needed

## API Usage

The iOS app fetches the catalog from:
```
https://raw.githubusercontent.com/XavierKain/paraflightlog-wings/main/wings.json
```

Images are fetched from:
```
https://raw.githubusercontent.com/XavierKain/paraflightlog-wings/main/images/{wing-id}.png
```

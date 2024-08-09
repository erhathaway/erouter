template {
  source      = "./services.ctmpl"
  destination = "./services.json"
  command     = "kill -HUP $(pgrep -f 'bun run src/index.ts')"
}

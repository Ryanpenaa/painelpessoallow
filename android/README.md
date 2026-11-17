# TrackUp Android (APK de teste)

APK Android baseado em Trusted Web Activity, abrindo https://painelpessoallow.lovable.app/ no navegador do aparelho.

## Gerar APK sem computador
GitHub > Actions > **TrackUp Android APK** > Run workflow. O arquivo `trackup-android-debug` fica em Artifacts do workflow (ZIP com app-debug.apk).

A compilação automática ocorre também quando arquivos em `android/` ou `public/favicon.svg` mudam na branch principal.

## Ícone
O workflow converte automaticamente `public/favicon.svg` para PNG e utiliza o mesmo ícone do site.

## Atualizações
Alterações do painel hospedado aparecem no Android sem novo APK. Mudanças em código Android requerem novo APK.

## Importante para testes
Sem `/.well-known/assetlinks.json` no domínio do site, o navegador mostrará barra/identidade do browser (Custom Tab) em vez de modo TWA completamente sem interface. Para ativar tela cheia, hospede em domínio controlado e publique o Digital Asset Links para a assinatura definitiva do app.

O APK de debug é assinado com chave de desenvolvimento do ambiente de build, que pode mudar. Para atualizações instaláveis sem desinstalar, use assinatura persistente para builds de teste ou release. Evite distribuir APK de debug como aplicativo definitivo.

O aplicativo carrega o site online; exibição/remoção de badge do Lovable é responsabilidade do site e da hospedagem, não do APK.

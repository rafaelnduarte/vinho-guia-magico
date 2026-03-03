/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha — Jovem do Vinho</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://hrpnufesbjmaaiqgjwtn.supabase.co/storage/v1/object/public/email-assets/logo-jovem-do-vinho.png" width="64" height="64" alt="Jovem do Vinho" style={logo} />
        <Heading style={h1}>Redefinir senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta no Radar do Jovem. Clique no botão abaixo para escolher uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Redefinir senha
        </Button>
        <Text style={footer}>
          Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const logo = { margin: '0 auto 24px', borderRadius: '50%' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0D1F38',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55657a',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const button = {
  backgroundColor: '#1F5470',
  color: '#f0f9ff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }

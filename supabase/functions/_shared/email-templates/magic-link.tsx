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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso — Jovem do Vinho</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://hrpnufesbjmaaiqgjwtn.supabase.co/storage/v1/object/public/email-assets/logo-jovem-do-vinho.png" width="64" height="64" alt="Jovem do Vinho" style={logo} />
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Clique no botão abaixo para acessar o Radar do Jovem. Este link expira em breve.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar
        </Button>
        <Text style={footer}>
          Se você não solicitou este link, ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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

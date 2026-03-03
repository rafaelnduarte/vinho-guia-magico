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
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail — Jovem do Vinho</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://hrpnufesbjmaaiqgjwtn.supabase.co/storage/v1/object/public/email-assets/logo-jovem-do-vinho.png" width="64" height="64" alt="Jovem do Vinho" style={logo} />
        <Heading style={h1}>Confirme seu e-mail</Heading>
        <Text style={text}>
          Bem-vindo ao{' '}
          <Link href={siteUrl} style={link}>
            <strong>Radar do Jovem</strong>
          </Link>
          ! A maior curadoria independente do Brasil.
        </Text>
        <Text style={text}>
          Confirme seu endereço de e-mail (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Se você não criou uma conta, ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#1F5470', textDecoration: 'underline' }
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

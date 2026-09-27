import { Redirect } from 'expo-router';

import { useSession } from '../session/SessionContext';
import { rotaPara } from '../session/rotas';

/** Rota "/": encaminha para login, escolha de vinculo ou area do perfil. */
export default function Inicio() {
  const { sessao } = useSession();
  return <Redirect href={rotaPara(sessao)} />;
}

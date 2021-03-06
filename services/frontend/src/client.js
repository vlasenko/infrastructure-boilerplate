import React from 'react';
import { render } from 'react-dom';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

import routesFactory from 'routes';

const client = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: `${__API_FQDN__}/graphql`
  }),
  initialState: window.__INITIAL_STATE__
});

const { renderContext, routes } = routesFactory();

const root = document.getElementById('root');

render((
  <ApolloProvider client={client}>
    {routes}
  </ApolloProvider>
), document.getElementById('root'));

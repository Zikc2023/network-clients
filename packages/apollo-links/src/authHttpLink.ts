// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { from, ApolloLink, HttpOptions } from '@apollo/client/core';

import { ClusterAuthLink } from './auth-link';
import { DynamicHttpLink } from './dynamicHttpLink';
import AgreementManager from './agreementManager';
import { creatErrorLink } from './errorLink';
import { retryLink } from './retryLink';
import { Logger, silentLogger } from './logger';
import { FallbackLink } from './fallbackLink';

interface AuthHttpOptions {
  authUrl: string;             // auth service url
  projectId: string;           // project chain id or depployment id
  httpOptions: HttpOptions;    // http options for init `HttpLink`
  logger?: Logger              // logger for `AuthLink`
  fallbackServiceUrl?: string; // fall back service url for `AuthLink`
}

export function authHttpLink(options: AuthHttpOptions): ApolloLink {
  const { projectId, httpOptions, fallbackServiceUrl, authUrl, logger: _logger } = options;

  const logger = _logger ?? silentLogger();
  const agreementManager = new AgreementManager({ authUrl, projectId, logger });
  agreementManager.start();

  const errorLink = creatErrorLink(logger);
  const fallbackLink = new FallbackLink(fallbackServiceUrl)
  const httpLink = new DynamicHttpLink({ httpOptions });
  const authLink = new ClusterAuthLink({ authUrl, projectId, logger, agreementManager });

  // 1. errorLink: This link helps in handling and logging any GraphQL or network errors that may occur down the chain.
  //    Placing it at the beginning ensures that it catches any errors that may occur in any of the other links.
  // 2. retryLink: This comes after the errorLink to allow it to handle network errors and retry requests if necessary.
  // 3. authLink: The authLink comes next. It is responsible for adding authentication credentials to every request.
  // 4. httpLink: This should always be at the end of the link chain. This link is responsible for sending the request to the server.
  return from([errorLink, retryLink, authLink, fallbackLink, httpLink]);
}
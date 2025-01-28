module.exports = {
    mappings: {
      pinpointesdata: {
        properties: {
          application: {
            type: "nested",
            properties: {
              app_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              sdk: {
                type: "object",
              },
            },
          },
          arrival_timestamp: {
            type: "long",
          },
          attributes: {
            type: "nested",
            properties: {
              campaign_activity_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              campaign_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              campaign_send_status: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              campaign_send_status_code: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              campaign_send_status_message: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              delivery_type: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              feedback: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              treatment_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              user_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              "x-amz-request-id": {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
            },
          },
          awsAccountId: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword",
                ignore_above: 256,
              },
            },
          },
          client: {
            properties: {
              client_id: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
            },
          },
          client_context: {
            properties: {
              custom: {
                properties: {
                  endpoint: {
                    type: "text",
                    fields: {
                      keyword: {
                        type: "keyword",
                        ignore_above: 256,
                      },
                    },
                  },
                  legacy_identifier: {
                    type: "text",
                    fields: {
                      keyword: {
                        type: "keyword",
                        ignore_above: 256,
                      },
                    },
                  },
                },
              },
            },
          },
          device: {
            properties: {
              platform: {
                type: "object",
              },
            },
          },
          event_timestamp: {
            type: "long",
          },
          event_type: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword",
                ignore_above: 256,
              },
            },
          },
          event_version: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword",
                ignore_above: 256,
              },
            },
          },
          facets: {
            properties: {
              email_channel: {
                properties: {
                  mail_event: {
                    properties: {
                      bounce: {
                        properties: {
                          bounce_sub_type: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          bounce_type: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          bounced_recipients: {
                            properties: {
                              action: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              diagnostic_code: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              email_address: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              status: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                            },
                          },
                          feedback_id: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          reporting_mta: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                        },
                      },
                      delivery: {
                        properties: {
                          processing_time_millis: {
                            type: "long",
                          },
                          recipients: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          reporting_mta: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          smtp_response: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                        },
                      },
                      mail: {
                        properties: {
                          common_headers: {
                            properties: {
                              date: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              from: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              subject: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              to: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                            },
                          },
                          destination: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          from_address: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          headers: {
                            properties: {
                              name: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                              value: {
                                type: "text",
                                fields: {
                                  keyword: {
                                    type: "keyword",
                                    ignore_above: 256,
                                  },
                                },
                              },
                            },
                          },
                          headers_truncated: {
                            type: "boolean",
                          },
                          message_id: {
                            type: "text",
                            fields: {
                              keyword: {
                                type: "keyword",
                                ignore_above: 256,
                              },
                            },
                          },
                          message_send_timestamp: {
                            type: "long",
                          },
                        },
                      },
                      send: {
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
          session: {
            type: "object",
          },
        },
      },
    },
  };
  
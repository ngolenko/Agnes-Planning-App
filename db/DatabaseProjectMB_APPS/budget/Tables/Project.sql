CREATE TABLE [budget].[Project] (
    [Id]              INT            NOT NULL,
    [CustomerId]      INT            NULL,
    [ProjectName]     NVARCHAR (255) NULL,
    [LastInvoiceDate] AS             ([budget].[fnGetProjectLastInvoiceDate]([Id])),
    [ProjectType]     NVARCHAR (32)  CONSTRAINT [DF_Project_ProjectType] DEFAULT ('Time & Materials') NOT NULL,
    [IsActive]        BIT            NOT NULL CONSTRAINT [DF_Project_IsActive] DEFAULT ((1)),
    CONSTRAINT [PK_Project] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_Project_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [budget].[Customer] ([Id])
);


GO


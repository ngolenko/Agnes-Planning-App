CREATE TABLE [budget].[Invoice] (
    [Id]                INT             IDENTITY (1, 1) NOT NULL,
    [BudgetId]          INT             NULL,
    [ProjectId]         INT             NULL,
    [CustomerId]        INT             NULL,
    [InvoiceNumber]     NVARCHAR (255)  NULL,
    [InvoiceDate]       DATETIME        NULL,
    [InvoicePeriodFrom] DATETIME        NULL,
    [InvoicePeriodTo]   DATETIME        NULL,
    [InvoicedH]         DECIMAL (18, 2) NULL,
    [InvoicedEUR]       DECIMAL (18, 2) NULL,
    CONSTRAINT [PK_Invoice] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_Invoice_Budget] FOREIGN KEY ([BudgetId]) REFERENCES [budget].[Budget] ([Id]),
    CONSTRAINT [FK_Invoice_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [budget].[Customer] ([Id]),
    CONSTRAINT [FK_Invoice_Project] FOREIGN KEY ([ProjectId]) REFERENCES [budget].[Project] ([Id])
);


GO


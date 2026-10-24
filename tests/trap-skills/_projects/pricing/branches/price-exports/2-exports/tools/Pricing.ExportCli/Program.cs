using System;
using System.IO;
using System.Threading;
using Pricing.Domain;
using Pricing.Exports;
using Pricing.Infrastructure.Persistence;

if (args.Length != 1)
{
    Console.Error.WriteLine("usage: export-cli <file.csv>");
    return 2;
}

var store = new InMemoryStore();
var demo = new Product(Guid.NewGuid(), "SKU-1", "Молоко", Category.Grocery, 89.9m, "sup-1");
store.Products[demo.Id] = demo;

using var file = File.CreateText(args[0]);
await new PriceListExporter(new InMemoryProductRepository(store)).ExportAsync(file, CancellationToken.None);
Console.WriteLine("exported to " + args[0]);
return 0;
